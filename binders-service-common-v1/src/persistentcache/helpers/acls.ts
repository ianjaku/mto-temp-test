import { Acl, AssigneeGroup, AssigneeType, PermissionName, ResourcePermission } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { flatten } from "ramda";


export const filterAclsByAssignees = (
    assigneeGroups: AssigneeGroup[],
    acls: Acl[]
): Acl[] => {
    const assigneeIds = flatten(assigneeGroups.map(g => g.ids));
    const assigneeIdsSet = new Set(assigneeIds);
    return acls.filter(acl => (
        acl.assignees.some(assignee => {
            if (assignee.type === AssigneeType.PUBLIC) return true;
            return assignee.ids.some(
                id => assigneeIdsSet.has(id)
            );
        })
    ));
}

export const permissionNamesForAcls = (
    acls: Acl[]
): PermissionName[] => {
    const names = new Map<PermissionName, PermissionName>();
    for (const acl of acls) {
        for (const rule of acl.rules) {
            for (const permission of rule.permissions) {
                names.set(permission.name, permission.name);
            }
        }
    }
    return Array.from(names.values());
}

export const resourcePermissionsForAcls = (
    acls: Acl[]
): ResourcePermission[] => {
    const nestedRules = acls.map(acl => acl.rules);
    // Flattens the list 1 level
    return [].concat(...nestedRules);
}
