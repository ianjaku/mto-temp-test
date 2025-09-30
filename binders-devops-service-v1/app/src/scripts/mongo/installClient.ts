import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { HELM_PRODUCTION_MONGO_MANAGEMENT_DIR } from "../../lib/helm";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runHelmInstall } from "../../actions/helm/install";


const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        namespace: {
            long: "namespace",
            description: "The name of the k8s namespace to use",
            kind: OptionType.STRING,
        }
    };
    const parser = new CommandLineParser("installClient", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<unknown> parser.parse()) as any;
    if (options.aksClusterName === getProductionCluster() && !options.namespace) {
        options.namespace = PRODUCTION_NAMESPACE;
    }
    if (options.aksClusterName !== getProductionCluster() && !options.namespace) {
        options.namespace = "default";
    }
    return options;
};

main( async() => {
    const serviceReleaseName = "mongo-management";
    const { aksClusterName, namespace } = getOptions();
    const values = aksClusterName === getProductionCluster() ?
        {
            fqdns: "mongo.binders.media",
            "tls.secret": "tls-production-secret"
        } :
        {
            fqdns: "mongo.staging.binders.media",
            "tls.secret": "tls-staging-secret"
        };
    await runHelmInstall(".", serviceReleaseName,
        HELM_PRODUCTION_MONGO_MANAGEMENT_DIR,
        undefined, namespace, values);
});