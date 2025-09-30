

import { listResourceGroups } from "../../lib/azure";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const findAksResourceGroup = async (aksClusterName) => {
    const resourceGroups = await listResourceGroups();
    const resourceGroupPrefix = `MC_${aksClusterName}`;
    const matchingResourceGroups = resourceGroups.filter(rg => rg.startsWith(resourceGroupPrefix));
    if (matchingResourceGroups.length !== 1) {
        throw new Error(`Invalid number of resource groups (${matchingResourceGroups.length})
            matching prefix ${resourceGroupPrefix}`);
    }
    return matchingResourceGroups.pop();
};
