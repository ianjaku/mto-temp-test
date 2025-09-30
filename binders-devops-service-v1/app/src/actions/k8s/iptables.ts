import { getK8SNodes } from "./nodes";
import { log } from "../../lib/logging";
import { runCommand } from "../../lib/commands";

export interface ServiceNATRule {
    ip: string;
    port: number;
    weight: number;
}

const VERBOSE = false;

export type Protocol = "tcp" | "udp" | "all";

export interface IPTablesRule {
    chain: string;
    target: string;
    protocol: Protocol;
    opt: string;
    source: string;
    destination: string;
    comment: string;
    tail?: string;
}

export async function getIptableServiceRulesPerNode(serviceIP: string): Promise<{ [nodeNames: string]: ServiceNATRule[] }> {
    const nodes = await getK8SNodes();
    const nodeNames = nodes.map(node => node.name);
    const iptableRules = await Promise.all(nodeNames.map(n => getIptableServiceRules(n, serviceIP)));
    const result = {};
    nodeNames.forEach( (nodeName, index) => {
        result[nodeName] = iptableRules[index];
    })
    return result;
}

const buildLinePattern = () => {
    const ws = "\\s+";
    const target = "(\\S+)";
    const protocol = "(tcp|udp|all)";
    const opt = "(--)";
    const source = "(\\S+)";
    const destination = "(\\S+)";
    const comment = "(\\/\\*.+\\*\\/)";
    const tail = "([\\s\\S]*)";
    return new RegExp(`^${target}${ws}${protocol}${ws}${opt}${ws}${source}${ws}${destination}${ws}${comment}${tail}`);
}

const linePattern = buildLinePattern();

function parseRule(line: string): Omit<IPTablesRule, "chain"> | undefined {
    const match = line.match(linePattern);
    if (match) {
        return {
            target: match[1],
            protocol: match[2] as Protocol,
            opt: match[3],
            source: match[4],
            destination: match[5],
            comment: match[6],
            tail: match[7]
        }
    } else {
        if (VERBOSE) {
            log(`Could not parse line ${line}`);
        }
    }
    return undefined;
}

function parseRules(rulesAsText: string): IPTablesRule[] {
    let currentChain = "";
    const lines = rulesAsText.split("\n");
    const rules = [];
    for (const line of lines) {
        if (line == "" || line.startsWith("target     prot opt")) {
            continue;
        }
        if (line.startsWith("Chain")) {
            currentChain = line.split(" ")[1];
            continue;
        }
        const rule = parseRule(line);
        if (rule) {
            rules.push({
                chain: currentChain,
                ...rule
            });
        }
    }
    return rules;
}

function extractIpTablesProbability(tail: string): number {
    const match = tail.match(/probability (\d+\.\d+)/);
    if (!match) {
        return 0.0;
    } else {
        return parseFloat(match[1]);
    }
}

function ipTablesToNatRule(rule: IPTablesRule, weight: number): ServiceNATRule {
    const match = rule.tail.match(/to:(.+):(.+)/);
    if (!match) {
        throw new Error(`Could not extract NAT destination iptables rule ${rule.tail}`);
    }
    return {
        ip: match[1],
        port: parseInt(match[2]),
        weight
    }
}

function getServiceRules(parsedRules: IPTablesRule[], serviceIP): ServiceNATRule[] {

    const kubeServicesRule = parsedRules.find(rule =>
        rule.chain === "KUBE-SERVICES" &&
        rule.destination === serviceIP
    );
    if (!kubeServicesRule) {
        throw new Error(`Could not find KUBE-SERVICES rule for service ip ${serviceIP}`)
    }
    const kubeSvcChain = kubeServicesRule.target;
    const kubeSvcChainRules = parsedRules.filter(rule => (
        rule.chain === kubeSvcChain &&
        rule.target.startsWith("KUBE-SEP")
    ));
    const natRules = [];
    for (const kubeSvcChainRule of kubeSvcChainRules) {
        const kubeSepChain = kubeSvcChainRule.target;
        const weight = extractIpTablesProbability(kubeSvcChainRule.tail);
        const kubeSepChainRules = parsedRules.filter(rule => (
            rule.chain === kubeSepChain &&
            rule.target === "DNAT"
        ));
        for (const kubeSepChainRule of kubeSepChainRules) {
            const natRule = ipTablesToNatRule(kubeSepChainRule, weight);
            natRules.push(natRule);
        }
    }
    return natRules;
}

// const testLine = "KUBE-SEP-S47IGUQ75IPILEJL  all  --  anywhere             anywhere             /* gatekeeper-system/gatekeeper-webhook-service:https-webhook-server -> 10.244.10.8:8443 */ statistic mode random probability 0.50000000000"

export async function getIptableServiceRules(nodeName: string, serviceIP: string): Promise<ServiceNATRule[]> {
    const { output } = await runCommand(
        "kubectl",
        [ "node-shell", nodeName, "--", "bash", "-c",  "sleep 5 && iptables -t nat -L" ],
        { mute: true }
    );
    const parsedRules = parseRules(output);
    return getServiceRules(parsedRules, serviceIP);
}