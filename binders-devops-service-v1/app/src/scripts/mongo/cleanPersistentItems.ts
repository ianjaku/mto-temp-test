import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { MONGO_RELEASE_NAME } from "../../actions/helm/config";
import { cleanPersistantItems } from "../../lib/storage";
import { getNamespace } from "../../lib/bindersenvironment";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";

interface ICleanPersistenVolumesOptions {
    aksClusterName: string;
    mongoClusterName: string;
    branch: string;
    commit: string;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        mongoClusterName: {
            long: "mongo-cluster-name",
            description: "The name of the mongo cluster",
            kind: OptionType.STRING,
            required: true,
            default: MONGO_RELEASE_NAME
        },
        branch: {
            long: "branch",
            short: "b",
            description: "The environment branch",
            kind: OptionType.STRING,
            required: true
        },
        commit: {
            long: "commit",
            description: "The commit ref for this environment",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("cleanPersistentItems", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown> parser.parse()) as ICleanPersistenVolumesOptions;
};

main( async() => {
    const { aksClusterName, branch, commit, mongoClusterName } = getOptions();
    const isProduction = aksClusterName === getProductionCluster();
    const namespace = getNamespace({branch, services: [] , commitRef: commit, isProduction});
    await cleanPersistantItems(aksClusterName, mongoClusterName, namespace);
});