import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { Conditions, Policy, createPolicy, maybeInstallKyverno } from "../../lib/kyverno";
import { dumpFile } from "../../lib/fs";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { runKubeCtlFile } from "../../lib/k8s";
import { yamlStringify } from "../../lib/yaml";

const REMOVE_MESSAGE_PREFIX = "Oops! You are not allowed to remove"

function forbidDeleteRequest(): Conditions {
    return {
        key: "{{request.operation}}",
        operator: "Equals",
        value: "DELETE"
    }
}

function getPolicies(): Policy[] {
    const crucialNamespaces = ["production", "test", "monitoring"]
    return [
        {
            name: "block-crucial-namespaces-deletion",
            rules: [{
                name: "match-crucial-namespaces",
                matchers: [{
                    kinds: ["Namespace"],
                    names: crucialNamespaces

                }],
                anyOrAllStatement: "all",
                validation: {
                    anyOrAllStatement: "all",
                    message: `${REMOVE_MESSAGE_PREFIX} a Namespace ${crucialNamespaces.join(", ")}`,
                    deny: {
                        conditions: [forbidDeleteRequest()]
                    }
                }
            }],
            validationFailureAction: "Enforce"
        },
        {
            name: "block-deletion-of-statefulset",
            rules: [{
                name: "match-crucial-statefulset",
                matchers: [{
                    kinds: ["StatefulSet"],
                    namespaces: crucialNamespaces
                }],
                anyOrAllStatement: "all",
                validation: {
                    anyOrAllStatement: "all",
                    message: `${REMOVE_MESSAGE_PREFIX} statefulset in Namespace ${crucialNamespaces.join(", ")}`,
                    deny: {
                        conditions: [forbidDeleteRequest()]
                    }
                }
            }],
            validationFailureAction: "Enforce"
        }
    ]
}

type KyvernoPoliciesOptions = {
    aksClusterName: string
};

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
    };
    const parser = new CommandLineParser("createMongoReplicaSet", programDefinition);
    return parser.parse<KyvernoPoliciesOptions>();
};

async function runPolicies(policies: Policy[]) {
    log(`Creating policy definitions policies ${policies.map(p => p.name).join(" ")}`)
    const fileContents = policies.map(createPolicy)
        .map(policy => yamlStringify(policy))
        .join("\n---\n");
    const file = "/tmp/local-dev.yaml";
    await dumpFile(file, fileContents);
    await runKubeCtlFile(file, false);
}

main(async () => {
    const { aksClusterName } = getOptions()
    await runGetKubeCtlConfig(aksClusterName);
    await maybeInstallKyverno()
    const policies = getPolicies()
    await runPolicies(policies)
})