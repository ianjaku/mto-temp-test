import { ResourceGroup, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";


export const getResourceGroups = async (
    resourceType: ResourceType,
    resourceId: string,
    fetchAncestorIds: (itemId: string) => Promise<string[]>
): Promise<ResourceGroup[]> => {
    switch (resourceType) {
        case ResourceType.DOCUMENT:
            return [{
                type: ResourceType.DOCUMENT,
                ids: await fetchAncestorIds(resourceId)
            }]
        default:
            return Promise.resolve([
                {
                    type: resourceType,
                    ids: [resourceId]
                }
            ]);
    }
}
