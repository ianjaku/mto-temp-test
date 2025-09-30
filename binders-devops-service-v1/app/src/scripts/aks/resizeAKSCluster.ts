import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { buildAndRunCommand, buildAzCommand } from "../../lib/commands";
import { main } from "../../lib/program";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        clusterName: {
            long: "cluster-name",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        nodeCount: {
            long: "node-count",
            description: "The desired number of nodes",
            kind: OptionType.INTEGER,
            required: true
        }
    };
    const parser = new CommandLineParser("resizeK8SCluster", programDefinition);
    return parser.parse();
};

const buildResizeCommand = (options) => {
    const { clusterName, nodeCount } = options;
    const commandParams = [
        "aks", "scale",
        "--name", clusterName,
        "--resource-group", clusterName,
        "--node-count", nodeCount
    ];
    return buildAzCommand(commandParams);
};

const runResizeCommand = async (options) => {
    await buildAndRunCommand(() => buildResizeCommand(options));
};

main(async () => {
    const options = getOptions();
    await runResizeCommand(options);
});
