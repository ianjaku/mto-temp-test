/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { deleteLabel, getK8SNodes } from "../../actions/k8s/nodes";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";


const getOptions = (): {aksClusterName: string, labelKey: string, labelValue: string} => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The name of the aks cluster",
            kind: OptionType.STRING,
            required: true
        },
        labelKey: {
            long: "label-key",
            short: "k",
            description: "The key of the label to delete",
            kind: OptionType.STRING,
        },
        labelValue: {
            long: "label-value",
            short: "v",
            description: "The value of the label to delete cluster",
            kind: OptionType.STRING,
        },
    };
    const parser = new CommandLineParser("deleteNodeLabels", programDefinition);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<unknown> parser.parse()) as any;
    if (!options.labelKey && !options.labelValue) {
        console.error("Need a key and/or value for the labels to delete");
        process.exit(1);
    }
    return options;
};

const doIt = async () => {
    const { aksClusterName, labelKey, labelValue } = getOptions();
    await runGetKubeCtlConfig(aksClusterName);
    const nodes = await getK8SNodes();
    const hasTagToDelete = ([key, value]) => (
        (!labelKey || key === labelKey) &&
        (!labelValue || value === labelValue)
    );
    for (const node of nodes) {
        for (const [key, value] of Object.entries(node.labels)) {
            if (hasTagToDelete([key,value])) {
                log(`Deleting label ${key} from ${node.name}`);
                await deleteLabel(node.name, key);
            }
        }
    }
}

main(doIt);