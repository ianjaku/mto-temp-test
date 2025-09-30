import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { cleanPersistantItems } from "../../lib/storage";
import { getClusterConfig } from "../../config/elasticClusters";
import { getHelmElasticReleaseName } from "../../actions/elastic/config";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

interface ICleanPersistenVolumesOptions {
    elasticClusterName: string;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        elasticClusterName: {
            long: "elastic-cluster-name",
            short: "n",
            description: "The name of the elastic cluster",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("cleanPersistentVolumes", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown> parser.parse()) as ICleanPersistenVolumesOptions;
};

main( async() => {
    const { elasticClusterName } = getOptions();
    const elasticConfig = getClusterConfig(elasticClusterName);
    const { aksClusterName, namespace } = elasticConfig;
    await runGetKubeCtlConfig(aksClusterName);
    const releaseName = getHelmElasticReleaseName(elasticClusterName, "service");
    await cleanPersistantItems(aksClusterName, releaseName, namespace);
});