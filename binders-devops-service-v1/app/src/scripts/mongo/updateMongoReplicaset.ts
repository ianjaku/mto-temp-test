import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { MONGO_RELEASE_NAME } from "../../actions/helm/config";
import { getAdminCredentials } from "../../actions/mongo/config";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { updateMongoService } from "../../actions/mongo/service";


interface IUpdateMongReplicaSetOptions {
    aksClusterName: string;
    mongoClusterName: string;
    namespace: string;
    k8sLabel: string;
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
            default: MONGO_RELEASE_NAME
        },
        k8sLabel: {
            long: "k8s-label",
            description: "The label assigned to the k8s node used as mongo cluster node",
            kind: OptionType.STRING,
            required: true,
            default: "mongo-main"
        },
    };
    const parser = new CommandLineParser("createMongoReplicaSet", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as IUpdateMongReplicaSetOptions;
};


main(async () => {
    const options = getOptions();
    const { aksClusterName, namespace, mongoClusterName } = options;
    // Run it make sure the env is set up correctly, instead of failing at the end
    getAdminCredentials();
    await runGetKubeCtlConfig(aksClusterName);
    await updateMongoService(mongoClusterName, namespace);
});
