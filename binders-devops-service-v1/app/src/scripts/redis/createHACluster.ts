import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { ICreateRedisClusterOptions, createBitnamiRedisCluster } from "../../actions/redis/create";
import { main } from "../../lib/program";

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
            description: "The kubernetes namespace where the cluster will be created",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("createMongoReplicaSet", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as ICreateRedisClusterOptions;
};

main(async () => {
    const { aksClusterName, namespace} = getOptions()
    await createBitnamiRedisCluster(aksClusterName, namespace)
});
