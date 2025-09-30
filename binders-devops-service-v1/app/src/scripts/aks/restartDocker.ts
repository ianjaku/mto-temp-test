import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { Command } from "../../lib/commands";
import { getSSHCommand } from "../../actions/aks/ssh";
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
    const sshCommand = await getSSHCommand(aksClusterName, node);
    const restartArgs = [...(sshCommand.args), "service", "docker", "restart"];
    const restartCommand = new Command(sshCommand.command, restartArgs);
    await restartCommand.run();
};

main(doIt);