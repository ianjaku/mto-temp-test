import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { runCommand, runGetKubeCtlConfig } from "../../lib/commands";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { uninstallTiller } from "../../actions/helm/setup";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        userName: {
            long: "user-name",
            short: "u",
            description: "Your username",
            kind: OptionType.STRING,
        }
    };
    const parser = new CommandLineParser("uninstall", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parser.parse() as any;
};

main( async () => {
    // eslint-disable-next-line prefer-const
    let { aksClusterName, userName } = getOptions();
    if (!userName) {
        log("Auto-detecting username");
        const { output } = await runCommand("whoami", [], { mute: true });
        userName = output.trim();
        if (!userName) {
            log("!!! Could not auto-detect username");
            process.exit(1);
        }
        log(`Found username ${userName}`);
    }
    await runGetKubeCtlConfig(aksClusterName, true);
    await uninstallTiller(userName);
});