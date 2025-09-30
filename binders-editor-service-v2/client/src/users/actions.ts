import {
    APIAccountWhitelistedEmails,
    APIGetUser,
    APIImportCevaUsers,
    APIImportUsers,
    APIInsertWhitelistedEmail,
    APIInviteUser,
    APIListUserAccess,
    APIListUserImportActions,
    APISearchGroups,
    APISearchUsersByTerm,
    APISendPasswordResetLink,
    APISetWhitelistedEmailActive,
    APIUpdateUser,
    APIUsersById,
    APIgetBouncedEmailInfo,
} from "./api";
import { Acl, Role } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    BouncedEmail,
    CevaUser,
    GroupMap,
    User,
    UserAccess,
    UserImportAction,
    UserImportResult,
    WhitelistedEmail
} from "@binders/client/lib/clients/userservice/v1/contract";
import {
    EditorEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import {
    KEY_ACCOUNT_USERIMPORTACTIONS,
    KEY_ACCOUNT_USERS,
    KEY_ACCOUNT_WHITELISTEDEMAILS,
    KEY_NEW_WHITELISTEDEMAIL,
    KEY_UPDATE_USERDATA,
    KEY_UPDATE_WHITELISTEDEMAIL_ACTIVE,
    KEY_USERS_IMPORTED
} from "./store";
import { APIAddUserToAccount } from "../accounts/api";
import { APICreateOneTimeToken } from "../credential/api";
import type { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import AccountStore from "../accounts/store";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { FlashMessages } from "../logging/FlashMessages";
import type { SearchUsersOrGroupsResult } from "./search";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { addRoleToRootCollection } from "../authorization/actions";
import debounce from "lodash.debounce";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import i18n from "@binders/client/lib/react/i18n";
import { updateAccountMembers } from "../accounts/actions";
import { wrapAction } from "../shared/fluxwebdata";

const accountUsersImpl = (accountId: string) => {
    const toWrap = () => {
        const account = AccountStore.getAccount(accountId);
        if (account === undefined) {
            throw new Error(i18n.t(TK.User_AccountNotAvailable, { accountId }));
        }
        const members = account ? account.members : [];
        return APIUsersById(members, true);
    }
    return wrapAction(
        toWrap,
        KEY_ACCOUNT_USERS,
        i18n.t(TK.User_CantLoadAccountUsers),
    );
}

export const accountUsers = debounce(
    accountUsersImpl,
    1000,
    { leading: true, trailing: false }
);

export const accountUserImportActions = (accountId: string): Promise<UserImportAction> => {
    const toWrap = () => {
        return APIListUserImportActions(accountId);
    }
    return wrapAction(
        toWrap,
        KEY_ACCOUNT_USERIMPORTACTIONS,
        i18n.t(TK.User_CantLoadImportActions),
    );
}

export function assignRole(
    roleName: string,
    userId: string,
    acls: Acl[],
    accountId: string,
    accountRoles: Role[],
): Promise<Acl> {
    if (roleName === "no_perm") {
        return Promise.resolve(undefined);
    }
    const roleObject = accountRoles.find(({ name }) => name === roleName);
    if (!roleObject) {
        throw new Error(i18n.t(TK.User_UnknownRole, { role: roleName }));
    }
    return addRoleToRootCollection(acls, roleObject, accountId, userId);
}

export const inviteUserToAccount = async (
    acls: Acl[],
    accountId: string,
    email: string,
    roleName: string,
    domain: string,
    accountRoles: Role[],
    myUser: User
): Promise<unknown> => {
    const toWrap = async () => {
        const account = AccountStore.getAccount(accountId);
        if (account === undefined) {
            throw new Error(i18n.t(TK.User_AccountNotAvailable, { accountId }));
        }
        return APIInviteUser(email, accountId, domain)
            .then((user) => {
                if (!user) {
                    FlashMessages.error(i18n.t(TK.User_CantInviteUser));
                    return accountUsers(accountId);
                }
                const userId = user.id;
                const members = [...account.members, userId];
                FlashMessages.success(i18n.t(TK.User_InvitationToEmail, { email }));
                eventQueue.log(
                    EventType.USER_ADDED_TO_ACCOUNT,
                    accountId,
                    {
                        accountId: accountId,
                        userId: userId
                    },
                    false,
                    myUser.id
                );
                captureFrontendEvent(EditorEvent.UserManagementAddUser);
                return addUserToAccount(userId, accountId, true)
                    .then(() => assignRole(roleName, userId, acls, accountId, accountRoles))
                    .then(() => {
                        updateAccountMembers(accountId, members);
                        return APIUsersById(members, true)
                    }).catch(() => {
                        FlashMessages.error(i18n.t(TK.User_CantAddUsetToAccount));
                        return accountUsers(accountId);
                    });
            }).catch(err => {
                /* eslint-disable no-console */
                console.error(err);
                FlashMessages.error(i18n.t(TK.User_CantInviteUser));
                return accountUsers(accountId);
            });
    };

    return wrapAction(
        toWrap,
        KEY_ACCOUNT_USERS,
        i18n.t(TK.User_CantInviteUser)
    );
}

export const accountWhitelistedEmails = (accountId: string): void => {
    wrapAction(
        () => APIAccountWhitelistedEmails(accountId),
        KEY_ACCOUNT_WHITELISTEDEMAILS,
        i18n.t(TK.User_CantLoadWhitelistedEmails),
    );
}

export async function loadListUserAccess(accountId: string, userId: string): Promise<UserAccess[]> {
    return await APIListUserAccess(accountId, userId);
}

export const sendInvitationMails = (
    logins: string[],
    accountId: string,
    domain: string
): Promise<UserImportResult[]> => {
    return APISendPasswordResetLink(logins, accountId, domain);
}


export function addUserToAccount(
    userId: string,
    accountId: string,
    skipDefaultPermissions?: boolean
): Promise<Account> {
    return APIAddUserToAccount(userId, accountId, skipDefaultPermissions);
}

export async function insertWhitelistedEmail(
    accountId: string,
    domain: string,
    pattern: string
): Promise<WhitelistedEmail> {
    const newWhitelistedEmail = await APIInsertWhitelistedEmail(accountId, domain, pattern);
    dispatch({
        type: KEY_NEW_WHITELISTEDEMAIL,
        body: newWhitelistedEmail
    });
    return newWhitelistedEmail;
}

export const setWhitelistedEmailActive = (
    id: string,
    active: boolean,
    accountId: string
): void => {
    APISetWhitelistedEmailActive(id, active, accountId).then(() => {
        dispatch({
            type: KEY_UPDATE_WHITELISTEDEMAIL_ACTIVE,
            body: { id, active },
        });
    })
}

export async function updateUser(user: User, accountId: string): Promise<void | User> {
    return APIUpdateUser(user, accountId).then(() => {
        dispatch({
            type: KEY_UPDATE_USERDATA,
            body: { user },
        });
    });
}


export async function getBouncedEmailInfo(address: string, accountId: string): Promise<BouncedEmail> {
    return APIgetBouncedEmailInfo(address, accountId).catch(() => {
        return undefined;
    });
}

export async function importCevaUsers(
    accountId: string,
    users: CevaUser[],
    myUser: User,
    replaceUsers: boolean,
): Promise<void> {
    captureFrontendEvent(EditorEvent.UserManagementImportCevaUsers, { count: users.length });
    const importResult = await APIImportCevaUsers(accountId, users, replaceUsers);
    importResult.userImportResults.forEach(im => {
        if (!im.exception) {
            eventQueue.log(
                EventType.USER_ADDED_TO_ACCOUNT,
                accountId,
                {
                    accountId: accountId,
                    userId: im.user.id
                },
                false,
                myUser.id
            );
        }
    });
    accountUsers(accountId);
    accountUserImportActions(accountId);
}

export async function importUsers(
    users: User[],
    accountId: string,
    domain: string,
    usergroupId: string,
    replaceInGroup: boolean,
    myUser: User,
    groupMap: GroupMap
): Promise<void> {
    if (domain === undefined) {
        throw new Error(i18n.t(TK.User_CantImportUsersInvalidDomain));
    }
    const importResult = await APIImportUsers(
        users,
        accountId,
        domain,
        usergroupId,
        replaceInGroup,
        groupMap
    );
    importResult.userImportResults.forEach(im => {
        if (!im.exception) {
            eventQueue.log(
                EventType.USER_ADDED_TO_ACCOUNT,
                accountId,
                {
                    accountId: accountId,
                    userId: im.user.id
                },
                false,
                myUser.id
            );
        }
    })
    dispatch({
        type: KEY_USERS_IMPORTED,
        body: importResult
    });
    captureFrontendEvent(EditorEvent.UserManagementImportUsers, {
        count: importResult?.userImportResults?.length
    });
}

export const searchUsers = async (
    accountId: string,
    query: string,
    needsEditorAccess?: boolean,
): Promise<SearchUsersOrGroupsResult> => {
    const result = await APISearchUsersByTerm(
        accountId,
        query,
        {
            maxResults: 25,
            ...(needsEditorAccess !== undefined ?
                { needsEditorAccess } :
                {}
            )
        }
    );
    const userEntries = result.hits.map(user => ({
        label: user.displayName,
        rawLabel: user.displayName,
        value: user.login,
        id: user.id
    }));
    return {
        hits: userEntries,
        totalHits: result.hitCount,
    };
}

export const searchGroups = async (
    accountId: string,
    query: string,
): Promise<SearchUsersOrGroupsResult> => {
    const result = await APISearchGroups(
        accountId,
        query,
        {
            maxResults: 250,
        }
    );
    const usergroupEntries = result.hits.map(group => ({
        label: group.name,
        rawLabel: group.name,
        value: group.name,
        id: group.id
    }));
    return {
        hits: usergroupEntries,
        totalHits: result.hitCount,
    };
}

export const populateUser = async (user: User): Promise<User> => {
    return APIGetUser(user.id);
}

export function generateInvitationToken(userId: string): Promise<string> {
    return APICreateOneTimeToken(userId, 30);
}
