import { BindersServiceClient, ClientRequestOptions, RequestHandler } from "../../client";
import {
    BouncedEmail,
    CanBeManagedByResponse,
    CevaUser,
    CreateDeviceTargetUserResult,
    DeviceTargetUserLink,
    GlobalUserCreations,
    GroupMap,
    IGroupCreateOptions,
    IMultiAddMembersOptions,
    ITermsInfo,
    IUserGroupsQuery,
    IUserTag,
    IWhitelistedEmailFilter,
    InsertUserTagOptions,
    MailMessage,
    ManageableGroupQueryOptions,
    MultiGetGroupMembersOptions,
    ScriptRunStat,
    SearchOptions,
    SyncEntraGroupMembersOptions,
    User,
    UserAccess,
    UserDetails,
    UserImportAction,
    UserImportResult,
    UserPreferences,
    UserQuery,
    UserSearchResult,
    UserServiceContract,
    UserTagsFilter,
    UserType,
    Usergroup,
    UsergroupDetails,
    UsergroupMembersMap,
    UsergroupQuery,
    UsergroupSearchResult,
    UsergroupsPerUser,
    UsersSearchByQueryOptions,
    WhitelistedEmail
} from "./contract";
import { Application } from "../../trackingservice/v1/contract";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import getRoutes from "./routes";


export class UserServiceClient extends BindersServiceClient implements UserServiceContract {
    updateLastOnline(userId: string): Promise<void> {
        const options = { pathParams: { userId } };
        return this.handleRequest("updateLastOnline", options);
    }

    inviteUser(login: string, accountId: string, domain: string): Promise<User> {
        const options = {
            body: {
                login,
                accountId,
                domain
            }
        };
        return this.handleRequest("inviteUser", options);
    }

    getBouncedEmails(lastDate: Date): Promise<Array<BouncedEmail>> {
        const options = {
            body: {
                lastDate
            }
        };
        return this.handleRequest("getBouncedEmails", options);
    }

    checkIfEmailBounced(address: string, accountId: string): Promise<BouncedEmail> {
        const options = {
            body: {
                address,
                accountId,
            }
        };
        return this.handleRequest("checkIfEmailBounced", options);
    }

    sendPasswordResetLinkTo(logins: string[], accountId: string, domain: string): Promise<Array<UserImportResult>> {
        const options = {
            body: {
                logins,
                accountId,
                domain
            }
        };
        return this.handleRequest("sendPasswordResetLinkTo", options);
    }

    sendPasswordResetLink(logins: string[], accountId: string): Promise<Array<UserImportResult>> {
        const options = {
            body: {
                logins,
                accountId
            }
        };
        return this.handleRequest("sendPasswordResetLink", options);
    }

    sendMePasswordResetLink(login: string, application: Application, domain?: string): Promise<void> {
        const options = {
            body: {
                login,
                application,
            },
            queryParams: {
                domain,
            }
        };
        return this.handleRequest("sendMePasswordResetLink", options);
    }

    listUserImportActions(accountId: string): Promise<Array<UserImportAction>> {
        const options = {
            pathParams: {
                accountId
            }
        };
        return this.handleRequest("listUserImportActions", options);
    }

    removeUserFromAccountUsergroups(
        accountId: string,
        userId: string,
        fromUserAgent?: string,
        fromUserId?: string,
        fromUserIp?: string | string[],
    ): Promise<void> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                fromUserAgent,
                fromUserId,
                fromUserIp,
                userId,
            }
        };
        return this.handleRequest("removeUserFromAccountUsergroups", options);
    }

    searchUsers(
        query: UserQuery,
        options: SearchOptions,
        accountIds?: string[]
    ): Promise<UserSearchResult> {
        const requestOptions: ClientRequestOptions = {
            body: {
                query,
                options,
                accountIds
            }
        };
        return this.handleRequest("searchUsers", requestOptions);
    }

    searchUsersBackend(
        query: UserQuery,
        options: SearchOptions
    ): Promise<UserSearchResult> {
        const requestOptions: ClientRequestOptions = {
            body: {
                query,
                options
            }
        };
        return this.handleRequest("searchUsersBackend", requestOptions);
    }

    searchUsergroups(query: UsergroupQuery, options: SearchOptions): Promise<UsergroupSearchResult> {
        const requestOptions: ClientRequestOptions = {
            body: {
                query,
                options
            }
        };
        return this.handleRequest("searchUsergroups", requestOptions);
    }

    searchUsersByTerm(accountId: string, query: string, options: UsersSearchByQueryOptions): Promise<UserSearchResult> {
        const requestOptions: ClientRequestOptions = {
            pathParams: {
                accountId,
            },
            body: {
                query,
                options
            }
        };
        return this.handleRequest("searchUsersByTerm", requestOptions);
    }

    searchGroups(accountId: string, query: string, options: SearchOptions): Promise<UsergroupSearchResult> {
        const requestOptions: ClientRequestOptions = {
            pathParams: {
                accountId,
            },
            body: {
                query,
                options,
            }
        };
        return this.handleRequest("searchGroups", requestOptions);
    }

    createGroup(accountId: string, name: string, options: Partial<IGroupCreateOptions> = {}): Promise<Usergroup> {
        const requestOptions: ClientRequestOptions = {
            pathParams: {
                accountId
            },
            body: {
                name,
                options
            }
        };
        return this.handleRequest("createGroup", requestOptions);
    }

    getGroups(accountId: string): Promise<Usergroup[]> {
        const options: ClientRequestOptions = {
            pathParams: {
                accountId
            }
        };
        return this.handleRequest("getGroups", options);
    }

    removeGroup(accountId: string, groupId: string): Promise<boolean> {
        const options: ClientRequestOptions = {
            pathParams: {
                accountId,
                groupId
            }
        };
        return this.handleRequest("removeGroup", options);
    }

    updateGroupOwners(accountId: string, groupId: string, ownerUserIds: string[]): Promise<void> {
        return this.handleRequest("updateGroupOwners", {
            pathParams: {
                accountId,
                groupId,
            },
            body: {
                ownerUserIds,
            },
        });
    }

    getManageableGroups(accountId: string, actorUserId: string, options: Partial<ManageableGroupQueryOptions> = {}): Promise<Usergroup[]> {
        return this.handleRequest("getManageableGroups", {
            pathParams: {
                accountId
            },
            body: {
                actorUserId,
                options
            }
        });
    }

    canBeManagedBy(managedUserAccountId: string, managedUserIds: string[], groupOwnerId: string): Promise<CanBeManagedByResponse> {
        const options = {
            body: {
                managedUserAccountId,
                managedUserIds,
                groupOwnerId
            }
        };
        return this.handleRequest("canBeManagedBy", options);
    }

    updateGroupName(accountId: string, groupId: string, name: string): Promise<Usergroup> {
        const options: ClientRequestOptions = {
            pathParams: {
                accountId,
                groupId
            },
            body: {
                name
            }
        };
        return this.handleRequest("updateGroupName", options);
    }

    getGroupMembers(accountId: string, groupId: string, options: SearchOptions): Promise<UsergroupDetails> {
        const requestOptions: ClientRequestOptions = {
            pathParams: {
                accountId,
                groupId
            },
            body: {
                options
            }
        };
        return this.handleRequest("getGroupMembers", requestOptions);
    }

    multiGetGroupMembers(accountId: string, groupIds: string[], options?: MultiGetGroupMembersOptions): Promise<UsergroupDetails[]> {
        const requestOptions: ClientRequestOptions = {
            pathParams: {
                accountId,
            },
            body: {
                groupIds,
                options,
            }
        };
        return this.handleRequest("multiGetGroupMembers", requestOptions);
    }

    multiGetGroupMemberIds(accountId: string, groupIds: string[]): Promise<UsergroupMembersMap> {
        const requestOptions: ClientRequestOptions = {
            pathParams: {
                accountId,
            },
            body: {
                groupIds
            }
        };
        return this.handleRequest("multiGetGroupMemberIds", requestOptions);
    }

    addGroupMember(accountId: string, groupId: string, userId: string): Promise<void> {
        const options: ClientRequestOptions = {
            pathParams: {
                accountId,
                groupId
            },
            body: {
                userId
            }
        };
        return this.handleRequest<void>("addGroupMember", options);
    }

    multiAddGroupMembers(accountId: string, userGroupsQuery: IUserGroupsQuery, userIds: string[], options: IMultiAddMembersOptions): Promise<Usergroup[]> {
        const reqOptions: ClientRequestOptions = {
            pathParams: {
                accountId,
            },
            body: {
                userGroupsQuery,
                userIds,
                options,
            }
        };
        return this.handleRequest<Usergroup[]>("multiAddGroupMembers", reqOptions);
    }

    removeGroupMember(accountId: string, groupId: string, userId: string): Promise<void> {
        const options: ClientRequestOptions = {
            pathParams: {
                accountId,
                groupId
            },
            body: {
                userId
            }
        };
        return this.handleRequest<void>("removeGroupMember", options);
    }


    constructor(endpointPrefix: string, requestHandler: RequestHandler, accountIdProvider?: () => string) {
        super(endpointPrefix, getRoutes(), requestHandler, accountIdProvider);
    }

    confirmUser(login: string): Promise<User> {
        const options = {
            body: {
                login
            }
        };
        return this.handleRequest("confirmUser", options);
    }

    createUser(
        login: string,
        displayName: string,
        firstName = "",
        lastName = "",
        type: UserType = UserType.Individual,
        licenseCount = 1,
        allowDuplicate = false
    ): Promise<User> {
        const options = {
            body: {
                login,
                displayName,
                firstName,
                lastName,
                allowDuplicate,
                type,
                licenseCount,
            }
        };
        return this.handleRequest("createUser", options);
    }

    createDeviceTargetUsers(names: string[], accountId: string, deviceUserEmail: string): Promise<CreateDeviceTargetUserResult> {
        const options = {
            body: {
                names,
                accountId,
                deviceUserEmail,
            }
        };
        return this.handleRequest("createDeviceTargetUsers", options);
    }

    assignDeviceTargetUsers(accountId: string, deviceUserId: string, userAndGroupIds: string[], usergroupIntersections: string[][] = []): Promise<DeviceTargetUserLink[]> {
        const options = {
            body: {
                accountId,
                deviceUserId,
                userAndGroupIds,
                usergroupIntersections,
            }
        };
        return this.handleRequest("assignDeviceTargetUsers", options);
    }

    getDeviceTargetUserLinks(accountId: string): Promise<DeviceTargetUserLink[]> {
        const options = {
            pathParams: {
                accountId,
            }
        };
        return this.handleRequest("getDeviceTargetUserLinks", options);
    }

    getDeviceTargetIds(accountId: string, deviceUserId: string, expandGroups?: boolean): Promise<string[]> {
        const options = {
            pathParams: {
                accountId,
                deviceUserId,
            },
            queryParams: {
                expandGroups: expandGroups ? "true" : "false"
            }
        };
        return this.handleRequest("getDeviceTargetIds", options);
    }

    importUsers(users: User[], accountId: string, domain: string, usergroupId: string = undefined, replaceInGroup = false, allGroups: GroupMap = {}): Promise<UserImportAction> {
        const options = {
            body: {
                users,
                accountId,
                domain,
                usergroupId,
                replaceInGroup,
                allGroups,
            }
        };
        return this.handleRequest("importUsers", options);
    }

    importCevaUsers(users: CevaUser[], accountId: string, replaceUsers: boolean): Promise<UserImportAction> {
        const options = {
            body: {
                users,
                accountId,
                replaceUsers,
            }
        };
        return this.handleRequest("importCevaUsers", options);
    }

    static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ): UserServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "user", version);
        return new UserServiceClient(versionedPath, requestHandler, accountIdProvider);
    }

    getPreferences(userId: string): Promise<UserPreferences> {
        const options = {
            pathParams: {
                userId
            },
            useDeviceTargetUserToken: true
        };
        return this.handleRequest("getPreferences", options);
    }

    getPreferencesMulti(userIds: string[]): Promise<{ [userId: string]: UserPreferences }> {
        const options = {
            body: {
                userIds
            },
        };
        return this.handleRequest("getPreferencesMulti", options);
    }

    getUser(userId: string): Promise<User> {
        const options = {
            pathParams: {
                userId
            }
        };
        return this.handleRequest("getUser", options);
    }


    // Ids can be group and/or user ids
    getUsers(ids: string[]): Promise<User[]> {
        const options = {
            body: {
                ids,
            }
        };
        return this.handleRequest("getUsers", options);
    }

    listUsers(): Promise<Array<User>> {
        return this.handleRequest("listUsers", {});
    }

    getUserByLogin(login: string): Promise<User> {
        const options = {
            body: {
                login
            },
        };
        return this.handleRequest("getUserByLogin", options);
    }

    listUserAccess(accountId: string, userId: string): Promise<UserAccess[]> {
        const options = { pathParams: { accountId, userId } };
        return this.handleRequest("listUserAccess", options);
    }

    myDetails(): Promise<UserDetails> {
        return this.handleRequest("myDetails", { useDeviceTargetUserToken: true });
    }

    savePreferences(userId: string | null, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
        const options = {
            pathParams: {
                userId
            },
            body: {
                preferences
            },
            useDeviceTargetUserToken: true
        };
        return this.handleRequest("savePreferences", options);
    }

    updateUser(user: User, accountId?: string): Promise<User> {
        const options = {
            pathParams: {
                userId: user.id
            },
            body: { user, accountId }
        };
        return this.handleRequest("updateUser", options);
    }

    whoAmI(): Promise<User> {
        return this.handleRequest("whoAmI", { useDeviceTargetUserToken: true });
    }

    findUserDetailsForIds(userIds: Array<string>, skipDeleted?: boolean): Promise<Array<User>> {
        const options = {
            body: { userIds, skipDeleted: !!skipDeleted },
        };
        return this.handleRequest("findUserDetailsForIds", options);
    }

    getGroupsForUser(userId: string, accountId: string): Promise<Array<Usergroup>> {
        const options = {
            pathParams: { userId, accountId }
        };
        return this.handleRequest("getGroupsForUser", options);
    }

    getGroupsForUserBackend(userId: string): Promise<Array<Usergroup>> {
        const options = {
            pathParams: { userId }
        };
        return this.handleRequest("getGroupsForUserBackend", options);
    }

    getGroupsForUsers(userIds: string[], accountId: string): Promise<UsergroupsPerUser> {
        const options = {
            body: { userIds, accountId }
        };
        return this.handleRequest("getGroupsForUsers", options);
    }

    requestInvitation(
        accountId: string,
        domain: string,
        email: string,
        interfaceLanguage: string,
        fromUserAgent?: string,
        fromUserId?: string,
        fromUserIp?: string,
    ): Promise<string> {
        const options = {
            body: {
                accountId,
                fromUserAgent,
                fromUserId,
                fromUserIp,
                domain,
                email,
                interfaceLanguage,
            }
        };
        return this.handleRequest("requestInvitation", options);
    }

    insertWhitelistedEmail(accountId: string, domain: string, pattern: string): Promise<WhitelistedEmail> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                domain,
                pattern
            }
        };
        return this.handleRequest("insertWhitelistedEmail", options);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    insertScriptRunStat(scriptName: string, data: any): Promise<ScriptRunStat> {
        const options = {
            body: {
                data,
                scriptName
            }
        };
        return this.handleRequest("insertScriptRunStat", options);
    }

    getLatestScriptStats(scriptName: string): Promise<ScriptRunStat> {
        const options = {
            pathParams: {
                scriptName
            }
        };
        return this.handleRequest("getLatestScriptStats", options);
    }

    setWhitelistedEmailActive(id: string, active: boolean, accountId?: string): Promise<void> {
        const options = {
            pathParams: {
                id
            },
            body: {
                active,
                accountId,
            }
        };
        return this.handleRequest<void>("setWhitelistedEmailActive", options);
    }

    listWhitelistedEmails(accountId: string, filter?: IWhitelistedEmailFilter): Promise<Array<WhitelistedEmail>> {
        const options = {
            pathParams: {
                accountId,
                ...(filter ? { filter: JSON.stringify(filter) } : {}),
            },
        };
        return this.handleRequest("listWhitelistedEmails", options);
    }

    saveTermsAcceptance(userId: string, accountId: string, version: string): Promise<void> {
        const options = {
            body: {
                userId,
                accountId,
                version,
            },
        };
        return this.handleRequest("saveTermsAcceptance", options);
    }

    getTermsInfo(accountId: string): Promise<ITermsInfo> {
        const options = {
            pathParams: { accountId },
        };
        return this.handleRequest("getTermsInfo", options);
    }

    deleteUser(userId: string): Promise<void> {
        return this.handleRequest("deleteUser", {
            pathParams: {
                userId
            }
        });
    }

    multiGetUsersAndGroups(
        accountId: string,
        ids: string[],
        includeDeleted = false
    ): Promise<Array<User | Usergroup>> {
        return this.handleRequest("multiGetUsersAndGroups", {
            body: {
                accountId,
                ids,
                includeDeleted
            }
        });
    }

    insertUserTag(userTag: IUserTag, options?: InsertUserTagOptions): Promise<void> {
        return this.handleRequest("insertUserTag", {
            body: {
                userTag,
                options,
            }
        });
    }

    getUserTags(userId: string, filter: UserTagsFilter = {}): Promise<IUserTag[]> {
        return this.handleRequest("getUserTags", {
            pathParams: {
                userId,
            },
            body: {
                filter,
            }
        });
    }

    getUsersCreatedPerMonth(): Promise<GlobalUserCreations> {
        return this.handleRequest("getUsersCreatedPerMonth", {});
    }

    getAccountIdsForGroups(groupIds: string[]): Promise<Record<string, string>> {
        return this.handleRequest("getAccountIdsForGroups", {
            body: {
                groupIds,
            }
        });
    }

    createUserWithCredentials(login: string, displayName: string, clearTextPassword: string): Promise<User> {
        return this.handleRequest("createUserWithCredentials", {
            body: { login, displayName, clearTextPassword },
        });
    }

    async createHubspotIdentifyToken(): Promise<{ token: string, email: string }> {
        return this.handleRequest(
            "createHubspotIdentifyToken",
            { useDeviceTargetUserToken: true }
        );
    }

    getMockedEmails(targetEmail: string): Promise<MailMessage[]> {
        return this.handleRequest("getMockedEmails", {
            pathParams: {
                targetEmail
            },
        });
    }

    syncEntraGroupMembers(accountId: string, options?: SyncEntraGroupMembersOptions): Promise<void> {
        return this.handleRequest("syncEntraGroupMembers", {
            body: { accountId, options },
        })
    }
}
