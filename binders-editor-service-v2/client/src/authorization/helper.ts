import { PermissionMap, PermissionName, ResourceGroup, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { intersection, uniq } from "ramda";

export const getEditableResources = (permissionMap) => {
    const matchingResourceGroups = permissionMap
        .filter(
            resourcePermission => resourcePermission.permission === PermissionName.EDIT
        )
        .map(resourcePermission => resourcePermission.resources);
    const flattened = [].concat(...matchingResourceGroups)
        .filter(resourceGroup => resourceGroup.type === ResourceType.DOCUMENT);

    let result = [];
    flattened.forEach(resourceGroup => result = result.concat(resourceGroup.ids));
    return result;
}

export const containsEditPermissions = (permissionMap) => {
    return containsPermission(permissionMap, PermissionName.EDIT);
}

export const containsReadPermissions = (permissionMap) => {
    return containsPermission(permissionMap, PermissionName.VIEW);
}

export const containsAdminPermissions = (permissionMap) => {
    return containsPermission(permissionMap, PermissionName.ADMIN);
}

const containsPermission = (permissionMap, permissionToCheck) => {
    const matchingPermissions = permissionMap.filter(
        resourcePermission => resourcePermission.permission === permissionToCheck
    );
    return matchingPermissions.length > 0;
}

export function getItemIdsFromPermissionMap(permissions: PermissionMap[], permissionNames?: PermissionName[]): string[] {
    const filtered = permissionNames ?
        permissions.filter(p => permissionNames.indexOf(p.permission) > -1) :
        permissions;
    return uniq(filtered.reduce(
        (res, { resources }) => [...res, ...resources.reduce(
            (prev, { ids }) => [...prev, ...ids],
            [])],
        []));
}

export const permissionsFoundInPaths = (idsArrays, permissionMap) => {
    for (const idsArray of idsArrays) {
        const found = permissionsFoundInPath(idsArray, permissionMap);
        if (found) {
            return true;
        }
    }
    return false;
}

export function permissionsFoundInPath(ids: string[], permissionMap: PermissionMap[]): boolean {
    const checkResourceGroup = (resourceGroup: ResourceGroup) => {
        const resourceIds = resourceGroup.ids;
        const overlappingIds = intersection(resourceIds, ids);
        return overlappingIds.length > 0;
    }

    const checkMapEntry = (entry: PermissionMap) => {
        return entry.resources.reduce(
            (foundResourceGroup, resourceGroup) => foundResourceGroup || checkResourceGroup(resourceGroup),
            false
        );
    }

    return permissionMap.reduce(
        (foundMapEntry, mapEntry) => foundMapEntry || checkMapEntry(mapEntry),
        false
    );
}
