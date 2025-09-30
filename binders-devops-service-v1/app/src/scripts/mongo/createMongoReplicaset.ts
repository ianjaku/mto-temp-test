import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { MONGO_RELEASE_NAME, MONGO_REPLICASET_NAME } from "../../actions/helm/config";
import { getAdminCredentials, initialConfiguration } from "../../actions/mongo/config";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { setupMongoInfrastructure } from "../../actions/mongo/setup";
import { setupMongoService } from "../../actions/mongo/service";

const DEFAULT_MONGO_CLUSTER_SIZE = 3;

interface ICreateMongReplicaSetOptions {
    aksClusterName: string;
    mongoClusterName: string;
    mongoClusterSize?: number;
    namespace: string;
    k8sLabel: string;
    omitLabelCheck: boolean
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "c",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        namespace: {
            long: "namespace",
            description: "The name of the k8s namespace in which cluster will be deployed",
            short: "n",
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
        mongoClusterSize: {
            long: "mongo-cluster-size",
            description: "The size of the new mongo cluster",
            kind: OptionType.INTEGER,
            default: DEFAULT_MONGO_CLUSTER_SIZE
        }
    };
    const parser = new CommandLineParser("createMongoReplicaSet", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as ICreateMongReplicaSetOptions;
};


main(async () => {
    const options = getOptions();
    const { aksClusterName, namespace, mongoClusterName, mongoClusterSize } = options;
    // Run it make sure the env is set up correctly, instead of failing at the end
    getAdminCredentials();

    await runGetKubeCtlConfig(aksClusterName);
    await setupMongoInfrastructure(mongoClusterName, namespace);
    await setupMongoService(mongoClusterName, mongoClusterSize, namespace);
    await initialConfiguration(MONGO_REPLICASET_NAME, namespace, mongoClusterSize);
});
