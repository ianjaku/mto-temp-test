import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { createClusterSnapshot } from "../../actions/elastic/backup";
import log from "../../lib/logging";
import { main } from "../../lib/program";

interface IProgramOptions {
    cluster: string;
}

const getOptions = (): IProgramOptions => {
    const programDefinition: IProgramDefinition = {
        cluster: {
            long: "cluster",
            short: "c",
            description: "The elastic cluster to snapshot",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("deploy", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse());
};

const doIt = async () => {
    const options = getOptions();
    log(`Starting backup of ${options.cluster}`);
    await createClusterSnapshot(options.cluster);
};

main(doIt);