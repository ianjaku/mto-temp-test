import { ResourceGroup } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { flatten } from "ramda";

export const filterResourceGroups = async (
    resourceGroups: ResourceGroup[],
    filter: (resourceIds: string[]) => string[] | Promise<string[]>
): Promise<ResourceGroup[]> => {
    const allIds = flatten(resourceGroups.map(g => g.ids));
    const filteredIds = await Promise.resolve(filter(allIds));
    const idsSet = new Set(filteredIds);
    
    const resultGroups: ResourceGroup[] = [];
    for (const resourceGroup of resourceGroups) {
        const newIds = resourceGroup.ids.filter(id => idsSet.has(id));
        if (newIds.length > 0) {
            resultGroups.push({
                ...resourceGroup,
                ids: newIds
            });
        }
    }
    return resultGroups;
}
