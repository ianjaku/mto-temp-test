/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { getK8SNodes } from "../../actions/k8s/nodes";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

const getOptions = (): {aksClusterName: string} => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The name of the aks cluster",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("printNodeLabels", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<unknown> parser.parse()) as any;
};

const doIt = async () => {
    const { aksClusterName } = getOptions();
    await runGetKubeCtlConfig(aksClusterName);
    const nodes = await getK8SNodes();
    for (const node of nodes) {
        console.log(node.name);
        for (const labelKey in node.labels) {
            console.log(`\t${labelKey}: ${node.labels[labelKey]}`);
        }
    }
}

main(doIt);