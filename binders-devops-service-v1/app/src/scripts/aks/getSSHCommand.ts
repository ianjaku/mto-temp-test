import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { getSSHCommand } from "../../actions/aks/ssh";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        node: {
            long: "node",
            description: "The node number",
            kind: OptionType.INTEGER,
            required: true
        }
    };

    const parser = new CommandLineParser("setupSSHAccess", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse());
};



const doIt = async() => {
    const { aksClusterName, node } = getOptions();
    await runGetKubeCtlConfig(aksClusterName, true);
    const command = await getSSHCommand(aksClusterName, node);
    log("\n\nRun this command:\n", "");
    log( [command.command, ...command.args].join(" "), "");
    log("\n\n", "");
};

main(doIt);