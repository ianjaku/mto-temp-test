import { buildAndRunCommand, buildAzCommand } from "./commands";
import { memoize } from "./memoize";

const getNodeResourceGroupNotCached = async (clusterName: string, resourceGroup?: string): Promise<string> => {
    const rg = resourceGroup ? resourceGroup : clusterName
    const args = [
        "aks", "show",
        "--resource-group", rg,
        "--name", clusterName,
        "--query", "nodeResourceGroup",
        "-o", "tsv"
    ];
    const { output } = await buildAndRunCommand(
        () => buildAzCommand(args),
        { mute: true }
    );
    return output.trim();
};

export const getNodeResourceGroup = memoize(getNodeResourceGroupNotCached);
