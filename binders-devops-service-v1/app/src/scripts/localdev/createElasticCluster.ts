import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { createEckDevK8sResources, waitForElasticUser } from "../../lib/eck";
import loadConfig from "../../lib/loadConfig";
import { main } from "../../lib/program";
import { maybeCleanElasticPersistentVolume } from "../../actions/elastic/eck";

interface CreateClusterOptions {
    namespace: string,
    loadProductionSecret: boolean
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        namespace: {
            long: "namespace",
            short: "n",
            description: "IP address",
            kind: OptionType.STRING,
            default: "develop"
        },
        loadProductionSecret: {
            long: "loadProductionSecret",
            short: "s",
            kind: OptionType.BOOLEAN,
            description: "Load staging secret",
        },

    }
    const parser = new CommandLineParser("UpOptions", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { namespace, loadProductionSecret } = (<any>parser.parse()) as CreateClusterOptions
    return {
        namespace,
        loadProductionSecret: !!loadProductionSecret,
    }
}

const doIt = async () => {
    const { namespace, loadProductionSecret } = getOptions()
    const configFilePath = `${__dirname}/devConfig.json`;
    const devConfig = await loadConfig(configFilePath);
    await maybeCleanElasticPersistentVolume()
    await createEckDevK8sResources(devConfig, "6", loadProductionSecret)
    await waitForElasticUser(namespace)
};

main(doIt);