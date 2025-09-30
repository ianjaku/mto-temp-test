import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { createCA, runTillerInit, setupHelm, setupTiller } from "../../actions/helm/setup";
import { runCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { homedir } from "os";
import log from "../../lib/logging";
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
        userName: {
            long: "user-name",
            short: "u",
            description: "Your username",
            kind: OptionType.STRING,
        }
    };
    const parser = new CommandLineParser("install", programDefinition);
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
    await runGetKubeCtlConfig(aksClusterName);
    const baseTLSDirectory = `${homedir()}/.binders/${aksClusterName}/tls`;
    await createCA(baseTLSDirectory);
    await setupTiller(baseTLSDirectory, userName);
    await setupHelm(baseTLSDirectory);
    await runTillerInit(baseTLSDirectory, userName);
});