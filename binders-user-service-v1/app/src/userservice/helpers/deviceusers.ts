import { intersection, uniq } from "ramda";
import { DeviceTargetUserLink } from "@binders/client/lib/clients/userservice/v1/contract";
import { isUsergroupId } from "@binders/client/lib/clients/userservice/v1/helpers";

/**
* Remap each DeviceTargetUserLink to a copy with resolved userIds
*
* - IDs in `userIds`:
*   All User IDs are remapped to itself
*   If an ID is a Group ID, it is replaced with user IDs in the group.
* - Group IDs in `usergroupIntersections` are resolved to the intersection of user IDs across the groups in each intersection.
*
*/
export async function resolveDeviceUserIds(
    links: DeviceTargetUserLink[],
    resolveGroupMembersById: (groupIds: string[]) => Promise<Record<string, string[]>>,
): Promise<DeviceTargetUserLink[]> {
    const allUsergroupIds = uniq(
        links
            .flatMap(link => [...link.userIds, ...link.usergroupIntersections.flat()])
            .filter(isUsergroupId)
    );
    const groupMembersById = new Map(Object.entries(
        await resolveGroupMembersById(allUsergroupIds)
    ));

    return links.map(link => {
        const resolvedUserIds = link.userIds.flatMap(id => {
            if (isUsergroupId(id)) return groupMembersById.get(id) ?? [];
            return [id];
        });
        const resolvedIntersectionsUserIds = link.usergroupIntersections.flatMap(
            ugi => ugi
                .map(groupId => groupMembersById.get(groupId) ?? [])
                .reduce(intersection)
        )
        const uniqueResolvedUserIds = new Set([...resolvedUserIds, ...resolvedIntersectionsUserIds]);

        return {
            deviceUserId: link.deviceUserId,
            userIds: link.userIds,
            resolvedUserIds: [...uniqueResolvedUserIds],
            usergroupIntersections: link.usergroupIntersections,
        }
    });
}
