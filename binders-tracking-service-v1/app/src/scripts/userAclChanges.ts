/* eslint-disable no-console */
/**
* See all permission changes for the given user in the given account
*
* Lists:
*  - Group changes (group removed, member removed, member added)
*  - Acl changes (acl removed, acl added, assignee removed, assignee added, restrictions changed)
*
* Usage:
*   node userAclChanges.js <ACCOUNT_ID> <USER_ID> <START_DATE> <END_DATE (optional)> <ITEM_ID (optional)>
*
* Dates can be in any format supported by the javascript Date function.
* An error will be thrown when an invalid date is provided.
*
* If only the date (wihout time) is provided. It will resolve to 00:00 as a time.
* This means that, if no time is provided that startDate will be included in the result
* but the enddate will not.
*
*/
import { Acl, PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    AuditLogRepositoryFactory,
    MongoAuditLogRepository
} from  "../trackingservice/repositories/auditLogRepository";
import {
    AuditLogType,
    IACLAuditLogData,
    IUserGroupAuditLogData,
    UserGroupActionType
} from  "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    BackendRepoServiceClient,
    BackendUserServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { compareDesc, isAfter, isBefore } from "date-fns";
import { AuditLog } from "../trackingservice/models/auditLog";
import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";

interface Context {
    startDate: Date;
    endDate: Date;
    userId: string;
    repo: MongoAuditLogRepository;
    accountId: string;
    itemId: string;
    userClient: UserServiceClient;
    repoClient: BinderRepositoryServiceClient;
}

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const getOptions = () => {
    const argLength = process.argv.length;
    if (argLength < 5 || argLength > 7) {
        console.log("Usage: node userAclChanges.js <ACCOUNT_ID> <USER_ID> <START_DATE> <END_DATE (optional)> <ITEM_ID (optional)>");
        process.exit(1);
    }
    const accountId = process.argv[2];
    if (!accountId.startsWith("aid")) {
        throw new Error("Account id is invalid " + process.argv[2]);
    }
    const userId = process.argv[3];
    if (!userId.startsWith("uid")) {
        throw new Error("User id is invalid " + process.argv[3]);
    }
    const startDate = new Date(process.argv[4]);
    if (isNaN(startDate.getTime())) {
        throw new Error("Start date is invalid " + process.argv[4]);
    }
    const endDate = new Date(process.argv[5] ?? new Date());
    if (isNaN(endDate.getTime())) {
        throw new Error("End date is invalid " + process.argv[5]);
    }
    const itemId = process.argv[6] ?? null;
    return {
        accountId,
        userId,
        startDate,
        endDate,
        itemId
    };
}

const createContext = async (): Promise<Context> => {
    const options = getOptions();
    const repoFactory = await AuditLogRepositoryFactory.fromConfig(config, logger);
    const repo = repoFactory.build(logger);

    const userClient = await BackendUserServiceClient.fromConfig(config, "user-acl-changes");
    const repoClient = await BackendRepoServiceClient.fromConfig(config, "user-acl-changes");

    return {
        userId: options.userId,
        accountId: options.accountId,
        startDate: options.startDate,
        endDate: options.endDate,
        itemId: options.itemId,
        repo,
        userClient,
        repoClient
    }
}

const fetchUserGroups = async (userId: string, accountId: string): Promise<Usergroup[]> => {
    const client = await BackendUserServiceClient.fromConfig(config, "user-acl-changes-from-audit");
    return await client.getGroupsForUser(userId, accountId);
}

const fetchRelevantGroups = async (context: Context) => {
    const groups: Record<string, string> = {};
    await context.repo.batchProcessLogs({
        accountId: context.accountId,
        data: {
            userId: context.userId
        },
        type: AuditLogType.USER_GROUP_UPDATE
    }, async (batch) => {
        batch.forEach(auditLog => {
            const data = auditLog.data as IUserGroupAuditLogData;
            groups[data.userGroupId] = data.userGroupId;
        })
    });
    return Object.values(groups);
}

interface GroupChange {
    timestamp: Date;
    groupAction: UserGroupActionType;
    groupId: string;
    userId?: string;
    actorId: string;
}

const fetchAclChanges = async (
    context: Context,
    relevantGroupIds: string[]
): Promise<AuditLog<IACLAuditLogData>[]> => {
    const assigneeIds = [
        context.userId,
        ...relevantGroupIds
    ]
    return context.repo.fetchAclLogs({
        startDate: context.startDate,
        endDate: context.endDate,
        accountId: context.accountId,
        assigneeIds,
        resourceIds: context.itemId == null ? undefined : [context.itemId]
    });
}

const fetchGroupChanges = async (
    context: Context,
    relevantGroupIds: string[]
): Promise<GroupChange[]> => {
    const changes: GroupChange[] = [];

    await context.repo.batchProcessLogs({
        accountId: context.accountId,
        data: {
            userGroupId: relevantGroupIds
        },
        startDate: context.startDate,
        type: AuditLogType.USER_GROUP_UPDATE
    }, async (batch) => {
        const relevantChanges = batch.map(auditLog => {
            const data = auditLog.data as IUserGroupAuditLogData;
            if (data.userGroupAction === UserGroupActionType.USER_GROUP_CREATED) {
                return null;
            }
            if (data.userId != null && data.userId !== context.userId) {
                return null;
            }
            return {
                timestamp: auditLog.timestamp,
                groupAction: data.userGroupAction,
                groupId: data.userGroupId,
                userId: data.userId,
                actorId: auditLog.userId?.value()
            }
        });
        changes.push(...relevantChanges.filter(c => c !== null));
    });
    return changes;
}

const uniqueStrings = (strings: string[]): string[] => {
    return Array.from(new Set(strings));
}

enum MergedChangeType {
    Group,
    Acl
}

type MergedChange = {
    type: MergedChangeType.Group;
    value: GroupChange;
    groups: string[]; // After the change
    actorId: string; // The user making the change
} | {
    type: MergedChangeType.Acl;
    value: AuditLog<IACLAuditLogData>;
    groups: string[];
    actorId: string;
}

const mergeChanges = (
    aclChanges: AuditLog<IACLAuditLogData>[],
    groupChanges: GroupChange[],
    groupsAtEndDate: string[]
) => {
    const groupChangesDesc = [...groupChanges].sort((a, b) => {
        return compareDesc(a.timestamp, b.timestamp);
    });
    const aclChangesDesc = [...aclChanges].sort((a, b) => {
        return compareDesc(a.timestamp, b.timestamp);
    });
    const mergedChanges: MergedChange[] = [];

    let groups = groupsAtEndDate;

    let groupIndex = 0;
    for (let aclIndex = 0; aclIndex < aclChangesDesc.length; aclIndex++) {
        const aclChange = aclChangesDesc[aclIndex];
        const aclChangeDate = new Date(aclChange.timestamp);
        for (; groupIndex < groupChangesDesc.length; groupIndex ++) {
            const groupChange = groupChangesDesc[groupIndex];
            if (isBefore(new Date(groupChange.timestamp), aclChangeDate)) {
                break;
            }
            groups = applyGroupChanges(groups, [groupChange]);
            mergedChanges.push({
                type: MergedChangeType.Group,
                value: groupChange,
                groups,
                actorId: groupChange.actorId
            });
        }
        mergedChanges.push({
            type: MergedChangeType.Acl,
            value: aclChange,
            groups,
            actorId: aclChange.userId?.value()
        });
    }
    for (; groupIndex < groupChangesDesc.length; groupIndex ++) {
        const groupChange = groupChangesDesc[groupIndex];
        groups = applyGroupChanges(groups, [groupChange]);
        mergedChanges.push({
            type: MergedChangeType.Group,
            value: groupChange,
            groups,
            actorId: groupChange.actorId
        });
    }
    return mergedChanges;
}

const applyGroupChanges = (
    groups: string[],
    groupChanges: GroupChange[]
): string[] => {
    const groupsSet = new Set(groups);
    for (const change of groupChanges) {
        if (change.groupAction === UserGroupActionType.USER_GROUP_DELETED) {
            groupsSet.delete(change.groupId);
        }
        if (change.groupAction === UserGroupActionType.USER_GROUP_MEMBER_REMOVED) {
            groupsSet.delete(change.groupId);
        }
        if (change.groupAction === UserGroupActionType.USER_GROUP_MEMBER_ADDED) {
            groupsSet.add(change.groupId);
        }
    }
    return Array.from(groupsSet);
}

const getGroupsAtDatetime = (
    datetime: Date,
    startGroups: string[],
    groupChangesDesc: GroupChange[]
): string[] => {
    const relevantChanges = groupChangesDesc.filter(change => {
        return isAfter(new Date(change.timestamp), datetime);
    });
    return applyGroupChanges(startGroups, relevantChanges);
}

const aclHasAnyAssignee = (
    acl: Acl,
    assignees: string[]
): boolean => {
    if (acl == null) return false;
    const assigneesSet = new Set(assignees);
    return acl.assignees.some(assignee => (
        assignee.ids.some(id => (
            assigneesSet.has(id)
        ))
    ));
}

const getResourcesFromAcl = (acl: Acl): string[] => {
    const resourceIds: string[] = [];
    for (const rule of acl.rules) {
        resourceIds.push(...rule.resource.ids);
    }
    return resourceIds;
}

const getAclDescription = (acl: Acl, itemNames: {[itemId: string]: string}) => {
    const resources = getResourcesFromAcl(acl);
    const resourceNames = resources.map(resId => {
        if (itemNames[resId] == null) return resId;
        const itemName = itemNames[resId].slice(0, 50);
        return `${resId} (${itemName})`;
    });

    const permissions = acl.rules.map(
        rule => rule.permissions.map(
            p => PermissionName[p.name]
        ).join(", ")
    ).join(", ");
    return `Permissions [${permissions}] on resources [${resourceNames.join(", ")}]`;
}

const fetchUsersAndGroupsForMergedChanges = async (
    context: Context,
    changes: MergedChange[]
): Promise<{
    users: Record<string, User>,
    groups: Record<string, Usergroup>
}> => {
    const ids = [];
    for (const change of changes) {
        if (change.type === MergedChangeType.Group) {
            ids.push(change.value.groupId)
        }
        if (change.actorId != null) {
            ids.push(change.actorId)
        }
    }
    if (ids.length === 0) {
        return {
            users: {},
            groups: {}
        }
    }

    const usersAndGroups = await context.userClient.multiGetUsersAndGroups(
        context.accountId,
        ids
    );

    const users = {};
    const groups = {};

    for (const userOrGroup of usersAndGroups) {
        if ("login" in userOrGroup) {
            users[userOrGroup.id] = userOrGroup;
        } else {
            groups[userOrGroup.id] = userOrGroup;
        }
    }

    return {
        users,
        groups
    }
}

const fetchItemNamesForChanges = async (
    context: Context,
    changes: AuditLog<IACLAuditLogData>[]
): Promise<{[itemId: string]: string}> => {
    const itemIds = new Set<string>();
    for (const change of changes) {
        if (change.data.oldAcl) {
            const resourceIds = getResourcesFromAcl(change.data.oldAcl);
            resourceIds.forEach(id => itemIds.add(id));
        }
        if (change.data.newAcl) {
            const resourceIds = getResourcesFromAcl(change.data.oldAcl);
            resourceIds.forEach(id => itemIds.add(id));
        }
    }

    const items = await context.repoClient.findItems({
        accountId: context.accountId,
        ids: Array.from(itemIds),
        summary: true,
        softDelete: {
            show: "show-all"
        }
    }, {
        maxResults: 5000
    });
    
    const titles = {};
    for (const item of items) {
        titles[item.id] = extractTitle(item);
    }
    return titles;
}

const run = async () => {
    const context = await createContext();

    const relevantGroupIds = await fetchRelevantGroups(context);
    const currentGroups = await fetchUserGroups(context.userId, context.accountId);
    const allRelevantGroups = uniqueStrings([...relevantGroupIds, ...currentGroups.map(g => g.id)]);

    const groupChanges = await fetchGroupChanges(context, allRelevantGroups);
    const groupChangesDesc = [...groupChanges].sort((a, b) => {
        return compareDesc(a.timestamp, b.timestamp);
    });

    const groupsAtEndDate = getGroupsAtDatetime(
        context.endDate,
        currentGroups.map(g => g.id),
        groupChangesDesc
    );
    const groupChangesDescBeforeEnd = groupChangesDesc.filter(groupChange => {
        return isBefore(new Date(groupChange.timestamp), context.endDate);
    });

    const aclChanges = await fetchAclChanges(context, allRelevantGroups);

    const mergedChanges = mergeChanges(
        aclChanges,
        groupChangesDescBeforeEnd,
        groupsAtEndDate
    );

    const {
        users,
        groups
    } = await fetchUsersAndGroupsForMergedChanges(context, mergedChanges);
    const itemNames = await fetchItemNamesForChanges(context, aclChanges);

    const mergedChangesOldestFirst = mergedChanges.reverse();

    const groupsAtStart = mergedChangesOldestFirst[0]?.groups ?? currentGroups.map(g => g.id);
    console.log("\n")
    console.log("Groups at startDate:", groupsAtStart);

    mergedChangesOldestFirst.forEach(change => {
        if (change.type === MergedChangeType.Group) {
            if (change.value.groupAction === UserGroupActionType.USER_GROUP_MEMBER_REMOVED) {
                console.log("[- GROUP]")
            } else if (change.value.groupAction === UserGroupActionType.USER_GROUP_DELETED) {
                console.log("[x GROUP]")
            } else if (change.value.groupAction === UserGroupActionType.USER_GROUP_MEMBER_ADDED) {
                console.log("[+ GROUP]")
            } else {
                return;
            }
            const groupName = groups[change.value.groupId]?.name;
            console.log("Group:", groupName, change.value.groupId);
        } else {
            const data = change.value.data;
            const assignees = [...change.groups, context.userId];
            const isMemberBefore = aclHasAnyAssignee(data.oldAcl, assignees);
            const isMemberAfter = aclHasAnyAssignee(data.newAcl, assignees);

            let acl: Acl;
            if (!isMemberBefore && isMemberAfter) {
                console.log("[+ ACL]");
                acl = data.newAcl;
            } else if (isMemberBefore && !isMemberAfter) {
                console.log("[- ACL]");
                acl = data.oldAcl;
            } else {
                return;
            }
            console.log(getAclDescription(acl, itemNames));
            if (
                acl.restrictionSet?.languageCodes &&
                acl.restrictionSet?.languageCodes.length > 0
            ) {
                console.log("Restrictions:", acl.restrictionSet.languageCodes)
            }
        }

        console.log("At:", change.value.timestamp);
        const actorId = change.actorId;
        if (actorId != null) {
            const user = users[actorId];
            if (user == null) {
                console.log("By:", actorId);
            } else {
                console.log("By:", user.login, user.displayName, actorId);
            }
        }
        console.log("\n");
    });
}

run()
    .then(() => {
        console.log("\n\n")
        console.log("-> Finished")
        console.log("\n\n")
    })
    .catch(err => console.log("Error:", err))
