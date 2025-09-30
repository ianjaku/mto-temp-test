import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { setupBasicAuth } from "../../actions/aks/access";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        }
    };

    const parser = new CommandLineParser("updateBasicAuth", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse());
};


const doIt = async () => {
    const { aksClusterName } = getOptions();
    await runGetKubeCtlConfig(aksClusterName);
    await setupBasicAuth();
};

main( doIt );