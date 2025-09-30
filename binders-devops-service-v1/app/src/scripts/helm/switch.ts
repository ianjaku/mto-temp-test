import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { copyHelmTLSFiles, getHelmTLSConfig, setupHelm } from "../../actions/helm/setup";
import { runCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { existsSync } from "fs";
import { homedir } from "os";
import { log } from "util";
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
    };
    const parser = new CommandLineParser("createAKSCluster", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parser.parse() as any;
};

const doIt = async () => {
    const { aksClusterName } = getOptions();
    log("Auto-detecting username");
    const { output } = await runCommand("whoami", [], { mute: true });
    const userName = output.trim();
    if (!userName) {
        log("!!! Could not auto-detect username");
        process.exit(1);
    }
    log(`Found username ${userName}`);
    await runGetKubeCtlConfig(aksClusterName, true);
    const baseTLSDirectory = `${homedir()}/.binders/${aksClusterName}/tls`;
    const { csr } = getHelmTLSConfig(baseTLSDirectory);
    if (existsSync(csr)) {
        await copyHelmTLSFiles(baseTLSDirectory);
    } else {
        await setupHelm(baseTLSDirectory);
    }
};

main(doIt);