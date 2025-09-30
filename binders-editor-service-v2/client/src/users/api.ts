import {
    BouncedEmail,
    CevaUser,
    CreateDeviceTargetUserResult,
    MultiGetGroupMembersOptions,
    SearchOptions,
    User,
    UserAccess,
    UserImportAction,
    UserImportResult,
    UserQuery,
    UserSearchResult,
    Usergroup,
    UsergroupDetails,
    UsergroupSearchResult,
    UsersSearchByQueryOptions,
    WhitelistedEmail
} from "@binders/client/lib/clients/userservice/v1/contract";
import AccountStore from "../accounts/store";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

export const userService: UserServiceClient = UserServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export const APIUpdateUser = (user: User, accountId: string): Promise<User> => userService.updateUser(user, accountId);

export const APIgetBouncedEmailInfo = (address: string, accountId: string): Promise<BouncedEmail> => {
    return userService.checkIfEmailBounced(address, accountId);
}

export const APIUsersById = (userIds: string[], skipDeleted: boolean): Promise<User[]> => userService.findUserDetailsForIds(userIds, skipDeleted);

export const APIRemoveUserFromAccountGroups = (accountId: string, userId: string): Promise<void> => userService.removeUserFromAccountUsergroups(accountId, userId);

export const APIMultiGetGroupMembers = async (accountId: string, groupIds: string[], options?: MultiGetGroupMembersOptions): Promise<UsergroupDetails[]> => userService.multiGetGroupMembers(accountId, groupIds, options);

export const APIRemoveGroupMember = async (accountId: string, usergroupId: string, userId: string): Promise<void> => userService.removeGroupMember(accountId, usergroupId, userId);

export const APIListUserImportActions = (accountId: string): Promise<UserImportAction[]> => userService.listUserImportActions(accountId);

export const APISendPasswordResetLink = (logins: string[], accountId: string, domain: string): Promise<UserImportResult[]> => userService.sendPasswordResetLinkTo(logins, accountId, domain);

export const APISendMePasswordResetLink = (login: string, domain: string): Promise<void> => userService.sendMePasswordResetLink(login, Application.EDITOR, domain);

export const APIInviteUser = (login: string, accountId: string, domain: string): Promise<User> => userService.inviteUser(login, accountId, domain);

export const APIAccountWhitelistedEmails = (accountId: string): Promise<WhitelistedEmail[]> => userService.listWhitelistedEmails(accountId);

export const APISetWhitelistedEmailActive = (id: string, active: boolean, accountId: string): Promise<void> => userService.setWhitelistedEmailActive(id, active, accountId);

export const APIInsertWhitelistedEmail = (accountId: string, domain: string, pattern: string): Promise<WhitelistedEmail> =>
    userService.insertWhitelistedEmail(accountId, domain, pattern);

export const APIImportUsers = (users: User[], accountId: string, domain: string, usergroupId: string, replaceInGroup: boolean, groupMap: Record<string, string>): Promise<UserImportAction> =>
    userService.importUsers(users, accountId, domain, usergroupId, replaceInGroup, groupMap);


export const APIImportCevaUsers = (accountId: string, users: CevaUser[], replaceUsers: boolean): Promise<UserImportAction> =>
    userService.importCevaUsers(users, accountId, replaceUsers);

export const APISearchUsersByTerm = (accountId: string, query: string, options: UsersSearchByQueryOptions): Promise<UserSearchResult> =>
    userService.searchUsersByTerm(accountId, query, options);

export const APISearchUsers = (query: UserQuery, options: SearchOptions, accountIds: string[] | undefined = undefined): Promise<UserSearchResult> =>
    userService.searchUsers(query, options, accountIds);

export const APISearchGroups = (accountId: string, query: string, options: SearchOptions): Promise<UsergroupSearchResult> =>
    userService.searchGroups(accountId, query, options);

export const APICreateUserWithCredentials = (login: string, name: string, clearTextPassword: string): Promise<User> => userService.createUserWithCredentials(login, name, clearTextPassword);

export const APIListUserAccess = (accountId: string, userId: string): Promise<UserAccess[]> => userService.listUserAccess(accountId, userId);

export const APIMultiGetUsersAndGroups = (accountId: string, userAndGroupIds: string[]): Promise<(Usergroup | User)[]> =>
    userService.multiGetUsersAndGroups(accountId, userAndGroupIds);

export const APICreateDeviceTargetUsers = (names: string[], accountId: string, deviceUserEmail: string): Promise<CreateDeviceTargetUserResult> =>
    userService.createDeviceTargetUsers(names, accountId, deviceUserEmail);

export const APIGetUser = (userId: string): Promise<User> => userService.getUser(userId);

export const APIUpdateGroupOwners = (accountId: string, groupId: string, ownerIds: string[]): Promise<void> => userService.updateGroupOwners(accountId, groupId, ownerIds);
