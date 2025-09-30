import {
    ACTION_LIFT_USERS_ADD_NEW,
    KEY_ACCOUNT_USERS,
} from "./store";
import {
    APICreateDeviceTargetUsers,
    APIRemoveGroupMember,
    APIRemoveUserFromAccountGroups,
    APIUsersById
} from "./api";
import { activateAccountId, myAccounts, updateAccountMembers } from "../accounts/actions";
import { APIRemoveUserAcls } from "../authorization/api";
import { APIRemoveUserFromAccount } from "../accounts/api";
import AccountStore from "../accounts/store";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import UserStore from "./store";
import { WebDataState } from "@binders/client/lib/webdata";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import i18n from "@binders/client/lib/react/i18n";
import { wrapAction } from "../shared/fluxwebdata";

export async function createDeviceTargetUsers(
    names: string[],
    accountId: string,
    deviceUserLogin: string
): Promise<User[]> {
    const { newUsers, accountMembers } = await APICreateDeviceTargetUsers(names, accountId, deviceUserLogin);
    dispatch({
        type: ACTION_LIFT_USERS_ADD_NEW,
        body: newUsers,
    });
    updateAccountMembers(accountId, accountMembers);
    return newUsers;
}

export async function removeUserFromOwnedUsergroup(
    accountId: string,
    usergroupId: string,
    userId: string,
    myUser: User,
): Promise<void> {
    const account = AccountStore.getAccount(accountId);
    if (account === undefined) {
        throw new Error(i18n.t(TK.User_AccountNotAvailable, { accountId }));
    }
    await APIRemoveGroupMember(accountId, usergroupId, userId);
    await APIRemoveUserAcls(accountId, userId);
    eventQueue.log(
        EventType.USER_DELETED_FROM_ACCOUNT,
        accountId,
        {
            accountId: accountId,
            userId: userId
        },
        false,
        myUser.id
    );
}


export async function removeUserFromAccount(
    accountId: string,
    userId: string,
    myUser: User,
): Promise<void> {
    const account = AccountStore.getAccount(accountId);
    if (account === undefined) {
        throw new Error(i18n.t(TK.User_AccountNotAvailable, { accountId }));
    }
    await Promise.all([
        APIRemoveUserFromAccountGroups(accountId, userId),
        APIRemoveUserAcls(accountId, userId)
    ]).then(() => APIRemoveUserFromAccount(accountId, userId));
    eventQueue.log(
        EventType.USER_DELETED_FROM_ACCOUNT,
        accountId,
        {
            accountId: accountId,
            userId: userId
        },
        false,
        myUser.id
    );
}

export async function fetchAndDispatchAccountUsers(accountId: string, memberIds: string[]): Promise<void> {
    await myAccounts();
    activateAccountId(accountId);
    wrapAction(
        () => APIUsersById(memberIds, true),
        KEY_ACCOUNT_USERS,
        i18n.t(TK.User_CantDeleteUser)
    );
}

export function getStoreUsersByIds(userIds: string[]): User[] {
    const allUsersWD = UserStore.accountUsers();
    if (!allUsersWD || allUsersWD.state !== WebDataState.SUCCESS) {
        return [];
    }
    const allUsers = allUsersWD.data;
    return userIds.map(userId => allUsers.find(user => user.id === userId)).filter(u => !!u);
}
