import {
    IAclRestrictionSet, IPermissionFlag, PermissionMap,
    PermissionName, ResourceGroupWithKey, ResourceType, Role
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { all, any, flatten, intersection, uniq } from "ramda";
import { buildAclKey, extractLanguagesFromResourceGroupKey, isRestrictedResourceGoup } from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import { APIAddDocumentAcl } from "./api";
import { IAccessDataAssignee } from "../shared/access-box";
import { Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TRANSLATOR_PSEUDO_NAME } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { ViewableResourcePermission } from "../browsing/util";
import { getItemIdsFromPermissionMap } from "./helper";

export async function ensureDocumentAcl(
    assignees: IAccessDataAssignee[],
    documentId: string,
    accountId: string,
    role: Role,
    aclRestrictionSet?: IAclRestrictionSet,
): Promise<string> {
    const realAcls = assignees
        .filter(({ isInheritedAcl }) => !isInheritedAcl)
        .reduce((prev, assignee) => ({ ...prev, [assignee.aclKey]: assignee.aclId }), {});

    const aclKey = buildAclKey(role.name, aclRestrictionSet);

    // there is no acl for selected role yet - we have to add it
    if (!realAcls[aclKey]) {
        const newAcl = await APIAddDocumentAcl(accountId, documentId, role.roleId, aclRestrictionSet);
        return newAcl.id;
    } else {
        return realAcls[aclKey];
    }
}


function inheritedFirst(
    a: ViewableResourcePermission,
    b: ViewableResourcePermission,
    isInherited: (resourceId: string) => boolean
) {
    const x = isInherited(a.ancestorResourceId);
    const y = isInherited(b.ancestorResourceId);
    if (x === y) {
        return 0;
    }
    if (x && !y) {
        return -1;
    }
    return 1;
}

export function getUiRoleName(
    role: Pick<Role, "name">,
    aclRestrictionSet: IAclRestrictionSet,
): string {
    const isTranslator = role.name === "Contributor" && ((aclRestrictionSet?.languageCodes) || []).length;
    return isTranslator ? TRANSLATOR_PSEUDO_NAME : role.name;
}

function isSuperiorRoleByName(accountRoles: Role[], previousName: string, nextName: string) {
    const previousRole = accountRoles.find(role => role.name === previousName);
    const nextRole = accountRoles.find(role => role.name === nextName);
    return nextRole.permissions.length > previousRole.permissions.length;
}

type AclUserOrGroup = ((User | Usergroup) & { nameValue?: string }) | undefined;

function aclUserOrGroupFromPermission(permission: ViewableResourcePermission, users: User[], usergroups: Usergroup[]): AclUserOrGroup {
    if (permission.assigneeId.startsWith("uid")) {
        const user = users.find(user => user.id === permission.assigneeId);
        if (!user) {
            return undefined;
        }
        return { ...user, nameValue: user.login };
    } else {
        const group = usergroups.find(userg => userg.id === permission.assigneeId);
        if (!group) {
            return undefined;
        }
        return { ...group, nameValue: group.name };
    }
}

export function buildAccessDataAssignees(
    permissions: ViewableResourcePermission[],
    documentId: string,
    users: User[],
    usergroups: Usergroup[],
    accountRoles: Role[],
    isHardRemoval = true,
    softRemovalId: string = undefined,
): IAccessDataAssignee[] {
    //todo: when we have multiple roles - we will have to have a "sort order" to tell which is stronger
    // for now I leave it hardcoded

    const isInheritedAcl = (resourceId: string) => (
        resourceId !== undefined && resourceId !== documentId
    );
    // so we are sure we first process inherited acls so the algorithm works correctly
    permissions.sort((a, b) => inheritedFirst(a, b, isInheritedAcl));
    return permissions.filter(p => !!p.assigneeId).reduce((rows: IAccessDataAssignee[], permission: ViewableResourcePermission) => {


        const item = aclUserOrGroupFromPermission(permission, users, usergroups);
        if (!item) {
            return rows;
        }

        const userIndex = rows.findIndex(row => (row.value === item.nameValue));
        const role = accountRoles.find(role => role.roleId === permission.roleId);

        if (!role) return [];

        const row: IAccessDataAssignee = {
            aclId: permission.aclId,
            label: item["displayName"] || item.nameValue,
            id: item.id,
            isInheritedAcl: isInheritedAcl(permission.ancestorResourceId),
            type: permission.assigneeType,
            value: item.nameValue,
            aclKey: role && buildAclKey(role.name, permission.aclRestrictionSet),
            aclRestrictionSet: permission.aclRestrictionSet,
            roleName: role.name,
            uiRoleName: getUiRoleName(role, permission.aclRestrictionSet),
        };

        rows.push(row);
        if (
            userIndex >= 0 &&
            row.isInheritedAcl === rows[userIndex].isInheritedAcl &&
            isSuperiorRoleByName(accountRoles, rows[userIndex].roleName, row.roleName)
        ) {
            rows.splice(userIndex, 1, row);
        } else if (userIndex >= 0 && !isHardRemoval && !row.isInheritedAcl && row.id === softRemovalId) {
            // todo we need to change logic for entire deletedAccessIds
            rows.splice(-1, 1);
        }
        return rows;
    }, []);
}

function matchInBreadcrumbsPaths(itemIds: string[], breadcrumbsPaths: Item[][]): boolean {
    const flattenedBreadcrumbsPaths = uniq(flatten(breadcrumbsPaths.map(breadcrumbsPath => breadcrumbsPath.map(item => item.id))));
    return intersection(itemIds, flattenedBreadcrumbsPaths).length > 0;
}

export function calculatePermissionFlags(
    breadcrumbsPaths: Item[][],
    permissionMaps: PermissionMap[],
    extraIds: string[]
): IPermissionFlag[] {
    const permissionFlags = calculateGeneralPermissionFlags(
        breadcrumbsPaths,
        permissionMaps,
        extraIds
    );

    const translatorLanguages = calculateTranslatorLanguages(breadcrumbsPaths, permissionMaps, extraIds);
    if (translatorLanguages.length > 0) {
        permissionFlags.push({
            permissionName: PermissionName.PUBLISH,
            languageCodes: translatorLanguages
        });
        permissionFlags.push({
            permissionName: PermissionName.REVIEW,
            languageCodes: translatorLanguages
        })
    }

    return permissionFlags;
}

const eligiblePermissions = [
    PermissionName.VIEW,
    PermissionName.EDIT,
    PermissionName.DELETE,
    PermissionName.CREATE,
    PermissionName.PUBLISH,
    PermissionName.ADMIN,
    PermissionName.REVIEW
];
function calculateGeneralPermissionFlags(
    breadcrumbsPaths: Item[][],
    permissionMaps: PermissionMap[],
    extraIds: string[]
): IPermissionFlag[] {
    return eligiblePermissions.reduce((flagsArr, permission) => {
        const permissionMap = permissionMaps.find(permissionInfo => permissionInfo.permission === permission);
        if (permissionMap) {
            const documentResourceGroups: ResourceGroupWithKey[] = <ResourceGroupWithKey[]>uniq(flatten((permissionMap.resources || []).filter(resource => resource.type === ResourceType.DOCUMENT)));

            for (const resourceGroup of documentResourceGroups) {
                const { ids, resourceGroupKey } = resourceGroup;
                if (intersection(ids, extraIds).length > 0 || matchInBreadcrumbsPaths(ids, breadcrumbsPaths)) {
                    const languageCodes = extractLanguagesFromResourceGroupKey(resourceGroupKey);
                    const flag = {
                        permissionName: permission,
                        ...(languageCodes ? { languageCodes } : {}),
                    }
                    return [...flagsArr, flag];
                }
            }
        }
        return flagsArr;
    }, [] as IPermissionFlag[]);
}

/**
 * Returns a list of langauges for which the user has edit permissions.
 * Does not return all languages if the user has edit permissionf or all langauges.
 */
function calculateTranslatorLanguages(
    breadcrumbsPaths: Item[][],
    permissionMaps: PermissionMap[],
    extraIds: string[]
) {
    const permissionMap = permissionMaps.find(
        permissionInfo => permissionInfo.permission === PermissionName.EDIT
    );
    if (permissionMap == null) return [];
    const documentResourceGroups: ResourceGroupWithKey[] =
        <ResourceGroupWithKey[]>uniq(flatten((permissionMap.resources || []).filter(resource => resource.type === ResourceType.DOCUMENT)));

    const languagesTheUserCanPublishIn: string[] = [];

    for (const resourceGroup of documentResourceGroups) {
        const { ids, resourceGroupKey } = resourceGroup;
        if (
            (extraIds.length > 0 && intersection(ids, extraIds).length > 0) ||
            matchInBreadcrumbsPaths(ids, breadcrumbsPaths)
        ) {
            const languageCodes = extractLanguagesFromResourceGroupKey(resourceGroupKey);
            if (languageCodes == null) continue;
            languagesTheUserCanPublishIn.push(...languageCodes);
        }
    }

    return languagesTheUserCanPublishIn;
}

export function permissionsForLanguageCode(
    permissionFlags: IPermissionFlag[],
    languageCode: string
): PermissionName[] {
    return permissionFlags.reduce((permissions, flag) => {
        if (permissions.includes(flag.permissionName)) return permissions;
        if (
            flag.languageCodes == null ||
            flag.languageCodes.includes(languageCode)
        ) {
            return [...permissions, flag.permissionName];
        }
        return permissions;
    }, [] as PermissionName[]);
}

export function flagsContainPermissions(
    permissionFlags: IPermissionFlag[],
    permissionNames: PermissionName[],
    options?: {
        requireAll?: boolean,
        languageCode?: string
    }
): boolean {
    const requireAll = options && options.requireAll;

    const anyOrAll = requireAll ? all : any;

    return anyOrAll((permission: PermissionName) => {
        return permissionFlags.some(pf => {
            if (pf.languageCodes == null) {
                return pf.permissionName === permission;
            }
            return pf.languageCodes.includes(options?.languageCode) && pf.permissionName === permission
        });
    }, permissionNames);
}

export function filterPermissionsWithRestrictions(permissions: PermissionMap[]): PermissionMap[] {
    return permissions.map(permissionMap => {
        // resourceGroups in the users permissionMaps are split between normal ones (with resourceGroupKey eg "1" (1 stands for ResourceType document))
        // and restricted ones (with resourceGroupKey eg "1_in_langCodes_fr").
        // this function filters out the resourceGroups to which the user only has restricted permissions
        return {
            ...permissionMap,
            resources: permissionMap.resources.filter((resourceGroup: ResourceGroupWithKey) => !isRestrictedResourceGoup(resourceGroup)),
        }
    });
}

export function checkHasFullPermissionInCurrentCollection(
    permissions: PermissionMap[],
    breadcrumbsPaths: Item[],
    permissionName: PermissionName
): boolean {
    const restrictionlessPermissions = filterPermissionsWithRestrictions(permissions);
    const itemsWithEditAcls = getItemIdsFromPermissionMap(restrictionlessPermissions, [permissionName]);
    return !!intersection(itemsWithEditAcls, [...(breadcrumbsPaths || [])].map(({ id }) => id)).length;
}

export function checkHasFullPermissionAnywhere(
    permissions: PermissionMap[],
    permissionName: PermissionName,
): boolean {
    const restrictionlessPermissions = filterPermissionsWithRestrictions(permissions);
    const itemsWithRelevantAcls = getItemIdsFromPermissionMap(restrictionlessPermissions, [permissionName]);
    return !!itemsWithRelevantAcls.length;
}
