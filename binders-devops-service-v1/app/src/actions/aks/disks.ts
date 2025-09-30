
import { deleteDisk as azDeleteDisk } from "../../lib/azure";
import { findAksResourceGroup } from "./resourcegroups";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const deleteDisk = async (aksClusterName, diskName) => {
    const resourceGroup = await findAksResourceGroup(aksClusterName);
    return azDeleteDisk(resourceGroup, diskName);
};
