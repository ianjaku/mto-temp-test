import {
    Acl,
    AssigneeType,
    IAclRestrictionSet,
    PermissionName,
    ResourcePermission,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { List } from "immutable";
import { TranslationKeys } from "@binders/client/lib/i18n/translations";
import { flatten } from "ramda";
import i18next from "i18next";
import { scorePermission } from "@binders/client/lib/clients/authorizationservice/v1/util";

export interface ViewableResourcePermission {
    permission: PermissionName;
    aclId: string;
    assigneeType: AssigneeType;
    assigneeId: string;
    ancestorResourceType?: ResourceType;
    ancestorResourceId?: string;
    roleId: string;
    aclRestrictionSet?: IAclRestrictionSet;
}

export interface ViewableResourcePermissionMap {
    resourceType: ResourceType;
    resourceId: string;
    permissions: ViewableResourcePermission[];
}

function pickRuleFromAcl(acl: Acl): ResourcePermission {
    if (acl.rules.length === 0) {
        throw new Error(i18next.t(TranslationKeys.Acl_InvalidACL));
    }
    const mappedRules = acl.rules.map(rule => {
        const bestPermissionWithScore = rule.permissions.slice(1).reduce((mostImportantPermissionWithScore, candidate) => {
            const newScore = scorePermission(candidate.name);
            return mostImportantPermissionWithScore.score < newScore ?
                { score: newScore, permission: candidate } :
                mostImportantPermissionWithScore;
        }, { permission: rule.permissions[0], score: scorePermission(rule.permissions[0].name) });
        return {
            rule,
            ...bestPermissionWithScore
        };
    });
    const bestWithScore = mappedRules.reduce((reduced, candidate) => {
        return candidate.score > reduced.score ? candidate : reduced;
    });
    return bestWithScore.rule;
}

function toViewableResourcePermission(resourceType: ResourceType, resourceId: string, acl: Acl): ViewableResourcePermission[] {

    const result = [];

    const rule = pickRuleFromAcl(acl);

    if (rule.permissions.length === 0) {
        return result;
    }

    const { permission } = rule.permissions.slice(1).reduce((mostImportantPermissionWithScore, candidate) => {
        const newScore = scorePermission(candidate.name);
        return mostImportantPermissionWithScore.score < newScore ?
            { score: newScore, permission: candidate } :
            mostImportantPermissionWithScore;
    }, { permission: rule.permissions[0], score: scorePermission(rule.permissions[0].name) });

    rule.resource.ids.forEach(aclResourceId => {
        acl.assignees.forEach(assigneeGroup => {
            const addToResult = (assigneeId) => {
                const ancestorResourceId = (resourceType === rule.resource.type && resourceId === aclResourceId) ?
                    undefined :
                    aclResourceId;
                result.push({
                    permission: permission.name, // @TODO when further optimizing acls - roles: this can probably go, as these viewables are on role-level
                    assigneeType: assigneeGroup.type,
                    assigneeId,
                    aclId: acl.id,
                    ancestorResourceType: ancestorResourceId ? rule.resource.type : undefined,
                    ancestorResourceId,
                    roleId: acl.roleId,
                    aclRestrictionSet: acl.restrictionSet,
                });
            };
            if (assigneeGroup.type === AssigneeType.PUBLIC) {
                addToResult(undefined);
            }
            else {
                assigneeGroup.ids.forEach(addToResult);
            }
        });
    });

    return result;
}

export function buildResourcePermissionMap(resourceType: ResourceType, resourceId: string, acls: List<Acl>): ViewableResourcePermissionMap {
    const viewables: Array<ViewableResourcePermission[]> = acls.map(acl => toViewableResourcePermission(resourceType, resourceId, acl)).toArray();
    return {
        resourceType,
        resourceId,
        permissions: flatten(viewables)
    };
}
