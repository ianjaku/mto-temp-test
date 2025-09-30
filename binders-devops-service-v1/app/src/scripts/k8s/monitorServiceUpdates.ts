import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { getEndpoints } from "../../actions/k8s/endpoints";
import { getIptableServiceRulesPerNode } from "../../actions/k8s/iptables";
import { getService } from "../../actions/k8s/services";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

const SCRIPT_NAME = "monitorServiceUpdates";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        service: {
            long: "service",
            short: "s",
            description: "The name of the service",
            kind: OptionType.STRING,
            required: true
        },
        namespace: {
            long: "namespace",
            short: "n",
            description: "The namespace of the service",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser(SCRIPT_NAME, programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<unknown> parser.parse()) as any;
    const serviceNames = BINDERS_SERVICE_SPECS
        .map(s => s.name);
    if (!serviceNames.includes(options.service)) {
        throw new Error(`Invalid service name ${options.service}. Valid names are ${serviceNames.join(", ")}`);
    }
    return options;
}

function compareEndPointsWithRules(endPoints, natRules) {
    const diff = {
        missingRules: [],
        extraRules: [],
    };
    for (const endPoint of endPoints) {
        if(!natRules.find(rule => rule.ip == endPoint.ip)) {
            diff.missingRules.push(endPoint.ip);
        }
    }
    for (const natRule of natRules) {
        if (!endPoints.find(endPoint => endPoint.ip == natRule.ip)) {
            diff.extraRules.push(natRule.ip);
        }
    }
    return diff;
}

function compareEndPointsAndAllNatRules(endPoints, natRulesPerNode) {
    for (const node in natRulesPerNode) {
        const nodeResult = compareEndPointsWithRules(endPoints, natRulesPerNode[node]);
        if (nodeResult.extraRules.length + nodeResult.missingRules.length == 0) {
            log(`NAT rules for node ${node} are fine for ${endPoints.length} endpoints.`);
        } else {
            const msg = `NAT rules diff for node ${node}:\n${JSON.stringify(nodeResult, null, 4)}`;
            log(msg);
        }
    }
}

main( async () => {
    const { namespace, service } = getOptions();
    const serviceSpec = BINDERS_SERVICE_SPECS.find(s => s.name == service);
    const fullServiceName = `${serviceSpec.name}-${serviceSpec.version}-service`;
    const k8sService = await getService(fullServiceName, namespace);
    if (!k8sService) {
        throw new Error(`Could not find service ${fullServiceName} in namespace ${namespace}`);
    }
    const serviceClusterIP = k8sService.spec.clusterIP;
    log(`Getting rules for service ${fullServiceName} and IP ${serviceClusterIP}`);

    const natRulesPerNode = await getIptableServiceRulesPerNode(serviceClusterIP);
    const endpoints = await getEndpoints(fullServiceName, namespace);
    await compareEndPointsAndAllNatRules(endpoints, natRulesPerNode);
})