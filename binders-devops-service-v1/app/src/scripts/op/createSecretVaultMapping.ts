/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { Env, parseEnv } from "../../lib/environment";
import { OnePasswordItemConfig, createOnePasswordItem } from "../../actions/op";
import { createKubeConfig } from "../../actions/k8s-client/util";
import { main } from "../../lib/program";

interface IVaultMappingOptions {
    clusterName: string;
    namespace: string
    env: Env;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        clusterName: {
            long: "cluster-name",
            short: "c",
            description: "The name of the kubernetes cluster",
            kind: OptionType.STRING,
            required: true
        },
        env: {
            long: "env",
            short: "e",
            kind: OptionType.STRING,
            description: "environment (dev, staging or production)",
            required: true
        },
        namespace: {
            long: "namespace",
            short: "n",
            description: "Namespace in which deployed is kibana connected to binders elastic cluster",
            kind: OptionType.STRING,
            default: "monitoring"
        }
    };
    const parser = new CommandLineParser("IVaultMappingOptions", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as IVaultMappingOptions;
};

const MONITORING_NAMESPACE = "monitoring"

main(async () => {
    const { clusterName, env, namespace } = getOptions()
    const environment = parseEnv(env)
    const developers = ["Dieter", "Octavian", "Ian", "Peter", "Tom", "Waldek"]

    const kubeConfig = await createKubeConfig(clusterName, { useAdminContext: true });
    for (const userName of developers) {
        const config: OnePasswordItemConfig = {
            environment,
            kubeConfig,
            namespace: MONITORING_NAMESPACE,
            userName,
            kind: "kibana"
        }
        await createOnePasswordItem({
            ...config,
            namespace: MONITORING_NAMESPACE
        });
        await createOnePasswordItem({
            ...config,
            namespace,
            kind: "kibana-binders"
        });

        if (environment === "production") {
            await createOnePasswordItem({
                ...config,
                kind: "grafana"
            });
        }
    }
})