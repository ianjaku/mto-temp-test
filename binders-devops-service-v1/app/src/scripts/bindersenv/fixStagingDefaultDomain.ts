import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { createAppsV1Api, createKubeConfig } from "../../actions/k8s-client/util";
import type { KubeConfig } from "@kubernetes/client-node";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

const servicesToUpdate = ["editor", "manualto", "manage", "dashboard"];
const envVariableName = "MANUALTO_DEFAULT_DOMAIN";

async function updateDeploymentEnvVariable(config: KubeConfig, namespace: string, value: string) {
    const k8sApi = await createAppsV1Api(config);
    try {
        const deploymentsResponse = await k8sApi.listNamespacedDeployment({ namespace });
        const deployments = deploymentsResponse.items;

        for (const deployment of deployments) {
            if (servicesToUpdate.some(service => deployment.metadata.name.includes(service))) {
                let updateRequired = false;
                const containers = deployment.spec.template.spec.containers;

                for (const container of containers) {
                    const env = container.env.find(envVar => envVar.name === envVariableName);
                    if (env && env.value !== value) {
                        env.value = value;
                        updateRequired = true;
                    }
                }

                if (updateRequired) {
                    await k8sApi.replaceNamespacedDeployment({
                        name: deployment.metadata.name,
                        namespace,
                        body: deployment
                    });
                    log(`Updated deployment: ${deployment.metadata.name} in namespace: ${namespace}`);
                }
            }
        }
    } catch (error) {
        log("Error updating deployments:", error);
    }
}


interface FixStagingDefaultDomainOptions {
    clusterName: string
    domain: string
    namespace: string
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        clusterName: {
            long: "cluster-name",
            short: "c",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        domain: {
            long: "domain",
            short: "d",
            description: "The default manualto domain that should be used in resolving getDomainFromRequest on staging env in case of prod restore",
            kind: OptionType.STRING,
            default: "demo.manual.to"
        },
        namespace: {
            long: "namespace",
            short: "n",
            description: "The k8s namespace",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("Rbac", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as FixStagingDefaultDomainOptions;
};

main(async () => {
    const { clusterName, domain, namespace} = getOptions()
    const kc = await createKubeConfig(clusterName, { useAdminContext: true });
    await updateDeploymentEnvVariable(kc, namespace, domain);
})