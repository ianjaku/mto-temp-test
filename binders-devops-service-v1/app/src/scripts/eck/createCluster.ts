import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { ElasticCompatibilityMode, createEckK8sResources, } from "../../lib/eck";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { maybeInstallEckOperator } from "../../actions/elastic/eck";

interface CreateClusterOptions {
    cluster: string;
    loadProductionSecret: boolean
    namespace: string
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        cluster: {
            long: "cluster",
            short: "c",
            description: "K8s cluster in which eck should be deployed",
            kind: OptionType.STRING,
            required: true
        },
        loadProductionSecret: {
            long: "loadProductionSecret",
            short: "s",
            kind: OptionType.BOOLEAN,
            description: "When true it will load create elastic repository connected to production storage account (production restore capability",
            default: false
        },
        namespace: {
            long: "namespace",
            short: "n",
            description: "k8s namespaces",
            kind: OptionType.STRING,
            required: true
        }
    };

    const parser = new CommandLineParser("CreateClusterOptions", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any>parser.parse()) as CreateClusterOptions
};

const doIt = async () => {
    const { cluster,  loadProductionSecret, namespace } = getOptions()
    const isProduction = cluster === getProductionCluster()
    await maybeInstallEckOperator()
    const eckConfig = {
        namespace,
        loadProductionBackup: loadProductionSecret,
        isProduction,
        minimal: false,
        k8sClusterName: cluster,
        compatibilityMode: "6" as ElasticCompatibilityMode
    }
    await createEckK8sResources(eckConfig)
}

main(doIt)