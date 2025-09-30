import {
    AccountServiceContract,
    ManageMemberTrigger
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    CevaUser,
    IUserTag,
    UserImportAction,
    UserImportResult,
    isCevaTestUser,
} from "@binders/client/lib/clients/userservice/v1/contract";
import { GroupNotFound, UsergroupRepository } from "../repositories/usergroups";
import { IUserTagRepository, UserTagNotFound } from "../repositories/userTags";
import {
    Login,
    UserIdentifier
} from "@binders/binders-service-common/lib/authentication/identity";
import {
    UserImportActionRepository,
    toModelUserImportResult
} from  "../repositories/userimportactions";
import { UserWithTags, enrichWithTags, getEmployeeIdTag } from "./tags";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { User } from "../models/user";
import { UserNotFound } from "@binders/client/lib/clients/userservice/v1/errors";
import { UserRepository } from "../repositories/users";
import { UserService } from "../service";
import { Usergroup } from "../models/usergroup";

function extractGroupNames(user: CevaUser): string[] {
    return [
        user.organization,
        user.service,
        user.department
    ]
}

async function extractAllUserGroups(
    users: CevaUser[],
    accountId: string,
    groupRepo: UsergroupRepository,
    logger: Logger
): Promise<Usergroup[]> {
    const groupSet = new Set(users.flatMap(extractGroupNames));
    const allGroups: Usergroup[] = [];
    for (const groupName of Array.from(groupSet)) {
        try {
            const group = await groupRepo.getUsergroupByName(accountId, groupName);
            allGroups.push(group);
        } catch (e) {
            if (e instanceof GroupNotFound) {
                logger.warn(`Group ${groupName} not found, skipping`, "ceva-import");
            } else {
                throw e;
            }
        }
    }
    return allGroups;
}

async function filterUserGroups(
    groups: Usergroup[],
    actorId: string,
    userService: UserService,
    accountId: string
): Promise<Usergroup[]> {
    const manageableGroups = await userService.getManageableGroups(accountId, actorId);
    const manageableGroupSet = new Set(manageableGroups.map(g => g.id));
    return groups.filter(g => manageableGroupSet.has(g.id.value()));
}

function isUserMemberOfAllowedGroups(user: CevaUser, allowedGroups: Usergroup[]): boolean {
    const groups = extractGroupNames(user);
    return allowedGroups.some(g => groups.includes(g.name));
}

function cevaUserToLogin(user: CevaUser): Login {
    const infix = isCevaTestUser(user) ? `-${user.tagPrefix}` : "";
    return new Login(`${user.employeeId}${infix}@ceva.manual.to`);
}

const USER_EXISTS_MSG = "User already exists";

async function getOrRestoreUserByTag(tag: IUserTag, userRepo: UserRepository, logger: Logger): Promise<{ user: User, exception?: string }> {
    const userId = new UserIdentifier(tag.id);
    try {
        const existingUser = await userRepo.getUser(userId);
        return {
            user: existingUser,
            exception: USER_EXISTS_MSG
        }
    } catch (e) {
        if (e instanceof UserNotFound) {
            await userRepo.restoreUser(userId);
            logger.info(`Restored user ${userId.value()}`, "ceva-import");
            const existingUser = await userRepo.getUser(userId);
            return {
                user: existingUser,
                exception: USER_EXISTS_MSG,
            };
        }
        throw e;
    }
}

async function ensureUser(
    cevaUser: CevaUser,
    userRepo: UserRepository,
    userTagRepo: IUserTagRepository,
    logger: Logger,
): Promise<UserImportResult> {
    const employeeIdTag = getEmployeeIdTag(cevaUser);
    try {
        const tag = await userTagRepo.getTag(
            employeeIdTag.name,
            employeeIdTag.value,
            employeeIdTag.context
        );
        const { user, exception } = await getOrRestoreUserByTag(tag, userRepo, logger);
        return {
            user: enrichWithTags(cevaUser, user),
            exception,
        };
    } catch (e) {
        if (e instanceof UserTagNotFound) {
            const login = cevaUserToLogin(cevaUser);
            try {
                const existingUser = await userRepo.getUserByLogin(login.value());
                return {
                    user: enrichWithTags(cevaUser, existingUser),
                    exception: USER_EXISTS_MSG
                }
            } catch (ex) {
                if (! (ex instanceof UserNotFound) ) {
                    throw ex;
                }
            }
            const {
                firstName,
                lastName
            } = cevaUser;
            const displayName = `${firstName} ${lastName}`;
            const newUser = User.create({ login, displayName, firstName, lastName });
            return {
                user: enrichWithTags(cevaUser, newUser),
                exception: undefined
            }
        }
        throw e;
    }
}

async function syncUserTags(users: UserWithTags[], tagRepo: IUserTagRepository): Promise<void> {
    const tags = users.flatMap(u => u.tags);
    await tagRepo.upsertMulti(tags);
}

async function syncGroupMemberships(
    accountId: string,
    allGroups: Usergroup[],
    groupMap: Record<string, string[]>,
    replaceUsers: boolean,
    userService: UserService,
    logger: Logger
): Promise<void> {
    for (const group of allGroups) {
        const groupName = group.name;
        const newGroupMembers = groupMap[groupName];
        if (newGroupMembers.length > 0) {
            logger.debug(`Syncing ${newGroupMembers.length} users to group ${groupName}, will replace them ${replaceUsers}`, "ceva-import");
            await userService.addGroupMembers(accountId, group.id.value(), newGroupMembers, replaceUsers);
        } else {
            logger.debug(`Skipping group ${groupName} (no change)`, "ceva-import");
        }
    }
}

async function ensureAccountMemberships(
    accountId: string,
    users: UserWithTags[],
    accountService: AccountServiceContract
): Promise<void> {
    const account = await accountService.getAccount(accountId);
    const { members: currentMembers } = account;
    const possiblyNewMembers = users.map(u => u.id.value());
    const currentMembersSet = new Set(currentMembers);
    const newMembers = possiblyNewMembers.filter(
        candidate => !currentMembersSet.has(candidate)
    );
    if (newMembers.length > 0) {
        await accountService.addMembers(accountId, newMembers, ManageMemberTrigger.USER_IMPORT);
    }
}

async function storeImportResult(
    result: UserImportAction,
    userImportActionRepo: UserImportActionRepository
): Promise<void> {
    const toStore = {
        ...result,
        userImportResults: result.userImportResults.map(toModelUserImportResult)
    };
    await userImportActionRepo.insertUserImportAction(toStore);
}

export async function importCevaUsers(
    cevaUsers: CevaUser[],
    accountId: string,
    actorId: string,
    replaceUsers: boolean,
    groupRepo: UsergroupRepository,
    userRepo: UserRepository,
    userTagRepo: IUserTagRepository,
    userImportActionRepo: UserImportActionRepository,
    accountService: AccountServiceContract,
    userService: UserService,
    logger: Logger
): Promise<UserImportAction> {
    const result: UserImportAction = {
        accountId,
        importDate: new Date().toISOString(),
        userImportResults: []
    };
    const usergroups = await extractAllUserGroups(cevaUsers, accountId, groupRepo, logger);
    const allowedUserGroups = await filterUserGroups(usergroups, actorId, userService, accountId);
    const groupMap = Object.fromEntries(allowedUserGroups.map(g => [g.name, [] as string[]]));
    const usersToCreate: UserWithTags[] = [];
    const existingUsers: UserWithTags[] = [];
    for (const cevaUser of cevaUsers) {
        if (!isUserMemberOfAllowedGroups(cevaUser, allowedUserGroups)) {
            logger.debug(`Skipping user ${cevaUser.employeeId} because it is not allowed`, "ceva-import");
            result.userImportResults.push({
                user: cevaUser,
                exception: "Not Allowed"
            });
            continue;
        }
        const importResult = await ensureUser(
            cevaUser,
            userRepo,
            userTagRepo,
            logger,
        );
        const user = importResult.user;
        if (importResult.exception === undefined) {
            usersToCreate.push(user);
        } else {
            existingUsers.push(user);
        }
        const userGroups = extractGroupNames(cevaUser);
        userGroups.forEach(g => {
            const userId = importResult?.user?.id?.value();
            if (groupMap[g] !== undefined && userId !== undefined) {
                groupMap[g].push(userId);
            }
        });
        result.userImportResults.push(importResult)
    }
    // Create the missing users
    await userRepo.insertUsers(usersToCreate);

    const allUsers = [
        ...usersToCreate,
        ...existingUsers
    ];

    await syncUserTags(allUsers, userTagRepo);
    await ensureAccountMemberships(accountId, allUsers, accountService);
    await syncGroupMemberships(accountId, allowedUserGroups, groupMap, replaceUsers, userService, logger);
    await storeImportResult(result, userImportActionRepo);
    return result;
}

