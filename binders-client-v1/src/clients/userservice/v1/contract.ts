import { AuthenticatedSession, MonthKey } from "../../model";
import { Application } from "../../trackingservice/v1/contract";
import { IAclRestrictionSet } from "../../authorizationservice/v1/contract";

export enum UserType {
    Individual,
    Device,
}

export enum UserCreationMethod {
    EDITOR = "EDITOR",
    PLG_TRIAL_V1 = "PLG_TRIAL_V1",
}

export interface User {
    id?: string;
    login: string;
    displayName: string;
    firstName: string;
    lastName: string;
    preferredLanguage?: string;
    created: Date;
    updated: Date;
    lastOnline?: Date;
    invitationToken?: string;
    groups?: string[];
    bounced?: boolean;
    type: UserType;
    licenseCount: number;
    userTags?: IUserTag[];
    isPasswordless?: boolean; // used in context of device target users
    creationMethod?: UserCreationMethod;
}

export interface GroupMap {
    [name: string]: string,
}

export interface UserImportAction {
    accountId: string;
    importDate: string;
    userImportResults: Array<UserImportResult>;
}

export interface UserImportActionQuery {
    accountId?: string;
    importDate?: Date;
    userImportResults?: Record<string, unknown>;
}

export interface UserImportResult {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any;
    userTags?: IUserTag[];
    exception?: string;
    skipInsert?: boolean;
    invitationLink?: string;
    invitationLinkSentDate?: Date;
}


export interface BouncedEmail {
    address: string;
    created_at: Date;
}

export interface UserPreferences {
    userId: string;
    readerLanguages?: string[];
    interfaceLanguage?: string;
    acknowledgementCookies?: boolean;
    defaultAnalyticsRange: string;
}

export interface IContentInfo {
    content: string;
    info: { titleOverride: string };
}

export interface ITermsInfo {
    version: string;
    titleOverride?: string;
    contentMap: { [languageCode: string]: IContentInfo };
}


export interface CevaUser {
    department: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    organization: string;
    service: string;
}

export interface CevaTestUser extends CevaUser {
    tagPrefix: string;
}

export function isCevaTestUser(user: CevaUser): user is CevaTestUser {
    return (user as CevaTestUser).tagPrefix !== undefined;
}

export function isCevaUser(user: unknown): user is CevaUser {
    return (user as CevaUser).employeeId !== undefined;
}

export interface ITermsMap {
    [accountId: string]: ITermsInfo;
}
export interface UserDetails {
    user: User;
    preferences: UserPreferences;
    sessionId?: string;
    canAccessBackend?: boolean;
    termsToAccept?: ITermsMap;
    isAllowedToChangePassword: boolean;
}

export interface Usergroup {
    id: string;
    name: string;
    isReadonly: boolean;
    isAutoManaged: boolean;
    accountId: string;
    ownerUserIds?: string[];
}

export interface UsergroupsPerUser {
    [userId: string]: Usergroup[];
}

export interface UsergroupMembersMap {
    [usergroupId: string]: string[],
}

export interface UsergroupDetails {
    group: Usergroup;
    memberCount: number;
    members: User[];
}

export interface SearchOptions {
    maxResults?: number;
    orderBy?: "login" | "name";
    sortOrder?: "ascending" | "descending";
}

export interface UsersSearchByQueryOptions extends SearchOptions {
    needsEditorAccess?: boolean; // filter users that don't have editor access
}

export interface RegExpQueryPart {
    val: string;
    isRegex: true;
}
export interface UserQuery {
    login?: string | RegExp | RegExpQueryPart;
    displayName?: string | RegExp | RegExpQueryPart;
    name?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    lastOnline?: Date;
    ignoreCase?: boolean;
    combineWithOr?: boolean
}

export interface UsergroupQuery {
    accountId?: string;
    nameRegex?: string;
    ownerId?: string;
}

export interface UserSearchResult {
    hitCount: number;
    hits: User[];
}

export interface UsergroupSearchResult {
    hitCount: number;
    hits: Usergroup[];
}

export interface UserDetailsSearchResult {
    hitCount: number;
    hits: UserDetails[];
}

export interface WhitelistedEmail {
    accountId: string;
    domain: string;
    pattern: string;
    active: boolean;
}

export interface IWhitelistedEmailFilter {
    isActive?: boolean;
}

export interface ScriptRunStat {
    scriptName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    runDateTime: Date;
}

export interface UserAccess {
    itemId: string;
    itemKind: "document" | "collection";
    itemTitle: string;
    itemLink: string;
    groups: string;
    role: string;
    restrictionSet: IAclRestrictionSet;
}

export interface UserAccessPerUser {
    [userId: string]: UserAccess[];
}
export interface IGroupCreateOptions {
    readonly: boolean;
}

export interface IMultiAddMembersOptions {
    doSync?: boolean;
    createGroupIfDoesntExist?: boolean;
    makeNewUsergroupReadonly?: boolean;
    makeNewUsergroupAutoManaged?: boolean;
}

export interface IUserGroupsQuery {
    names?: string[];
}

export interface ITermsAcceptanceEntry<UID = string> {
    userId: UID;
    accountId: string;
    acceptedTermsVersion: string;
}

export interface IUserTag {
    type: string
    id?: string;
    name: string;
    value: string;
    context: string;
}

export interface UserTagsFilter {
    context?: string;
    name?: string;
}

export interface DeviceTargetUserLink {
    deviceUserId: string;
    userIds: string[]; // These can be either user ids or group ids
    resolvedUserIds: string[]; // This is a combination of all user ids from the groups & user ids
    usergroupIntersections: string[][];
}

export interface CreateDeviceTargetUserResult {
    newUsers: User[];
    accountMembers: string[];
}

export interface CanBeManagedByResponse {
    [userId: string]: boolean;
}

export type GlobalUserCreations = Record<MonthKey, number>;

export interface MultiGetGroupMembersOptions {
    includeUserTags?: boolean;
}

export interface UsergroupQuery {
    accountId?: string;
    nameRegex?: string;
    ownerId?: string;
}

export interface ManageableGroupQueryOptions {
    includeAccountAdminGroup?: boolean;
    includeAutoManagedGroups?: boolean;
}

export interface MailMessage {
    to: string | string[];
    subject: string;
    text: string;
    html: string;

}

export interface InsertUserTagOptions {
    upsert?: boolean;
}

export interface SyncEntraGroupMembersOptions {
    dryRun?: boolean;
    debug?: boolean;
}

export interface UserServiceContract {
    createUser(login: string, displayName: string, firstName: string,
        lastName: string, type: UserType, licenseCount: number,
        allowDuplicate: boolean): Promise<User>;
    getDeviceTargetUserLinks(accountId: string): Promise<DeviceTargetUserLink[]>;
    getDeviceTargetIds(accountId: string, deviceUserId: string, expandGroups?: boolean): Promise<string[]>;
    createDeviceTargetUsers(names: string[], accountId: string, deviceUserEmail: string): Promise<CreateDeviceTargetUserResult>;
    assignDeviceTargetUsers(accountId: string, deviceUserId: string, userAndGroupIds: string[], usergroupIntersections: string[][]): Promise<DeviceTargetUserLink[]>;
    updateLastOnline(userId: string): Promise<void>;
    importUsers(users: User[], accountId: string, domain: string, usergroupId: string, replaceInGroup: boolean, allGroups: GroupMap): Promise<UserImportAction>;
    importCevaUsers(users: CevaUser[], accountId: string, replaceUsers: boolean, userId: string): Promise<UserImportAction>;
    getPreferences(userId: string): Promise<UserPreferences>;
    getPreferencesMulti(userIds: string[]): Promise<{ [userId: string]: UserPreferences }>;
    getUser(id: string): Promise<User>;
    /**
     * @param ids A list of user and/or group ids
     */
    getUsers(ids: string[]): Promise<User[]>;
    listUsers(): Promise<Array<User>>;
    getUserByLogin(login: string): Promise<User>;
    myDetails(session: AuthenticatedSession): Promise<UserDetails>;
    savePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences>;
    updateUser(user: User, accountId?: string): Promise<User>;
    whoAmI(session: AuthenticatedSession): Promise<User>;
    findUserDetailsForIds(userIds: Array<string>, skipDeleted?: boolean): Promise<Array<User>>;
    confirmUser(login: string): Promise<User>;
    searchUsers(
        query: UserQuery,
        options: SearchOptions,
        accountIds?: string[]
    ): Promise<UserSearchResult>;
    searchUsersBackend(
        query: UserQuery,
        options: SearchOptions
    ): Promise<UserSearchResult>;
    searchUsergroups(query: UsergroupQuery, options: SearchOptions): Promise<UsergroupSearchResult>;
    createGroup(accountId: string, name: string, options?: Partial<IGroupCreateOptions>): Promise<Usergroup>;
    getGroups(accountId: string): Promise<Usergroup[]>;
    removeGroup(accountId: string, groupId: string): Promise<boolean>;
    updateGroupOwners(accountId: string, groupId: string, ownerUserIds: string[]): Promise<void>;
    updateGroupName(accountId: string, groupId: string, name: string): Promise<Usergroup>;
    getGroupMembers(accountId: string, groupId: string, options: SearchOptions): Promise<UsergroupDetails>;
    getManageableGroups(accountId: string, actorUserId: string, options: Partial<ManageableGroupQueryOptions>): Promise<Usergroup[]>;
    canBeManagedBy(managedUserAccountId: string, managedUserIds: string[], groupOwnerId: string): Promise<CanBeManagedByResponse>;
    multiGetGroupMembers(accountId: string, groupIds: string[], options?: MultiGetGroupMembersOptions): Promise<UsergroupDetails[]>;
    multiGetGroupMemberIds(accountId: string, groupIds: string[]): Promise<UsergroupMembersMap>;
    addGroupMember(accountId: string, groupId: string, userId: string): Promise<void>;
    multiAddGroupMembers(accountId: string, userGroupsQuery: IUserGroupsQuery, userIds: string[], options?: IMultiAddMembersOptions): Promise<Usergroup[]>;
    removeGroupMember(accountId: string, groupId: string, userId: string): Promise<void>;
    removeUserFromAccountUsergroups(accountId: string, userId: string): Promise<void>;
    inviteUser(login: string, accountId: string, domain: string): Promise<User>;
    getBouncedEmails(lastDate: Date): Promise<Array<BouncedEmail>>;
    checkIfEmailBounced(address: string, accountId: string): Promise<BouncedEmail>;
    sendPasswordResetLinkTo(logins: Array<string>, accountId: string, domain: string): Promise<Array<UserImportResult>>;
    sendPasswordResetLink(logins: Array<string>, accountId: string): Promise<Array<UserImportResult>>;
    sendMePasswordResetLink(login: string, application: Application): Promise<void>;
    listUserImportActions(accountId: string): Promise<Array<UserImportAction>>;
    getGroupsForUser(userId: string, accountId: string): Promise<Array<Usergroup>>;
    getGroupsForUserBackend(userId: string): Promise<Array<Usergroup>>;
    getGroupsForUsers(userIds: string[], accountId: string): Promise<UsergroupsPerUser>;
    insertWhitelistedEmail(accountId: string, domain: string, pattern: string): Promise<WhitelistedEmail>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insertScriptRunStat(scriptName: string, data: any): Promise<ScriptRunStat>;
    getLatestScriptStats(scriptName: string): Promise<ScriptRunStat>;
    setWhitelistedEmailActive(id: string, active: boolean, accountId?: string): Promise<void>;
    listWhitelistedEmails(accountId: string, filter?: IWhitelistedEmailFilter): Promise<Array<WhitelistedEmail>>;
    requestInvitation(
        accountId: string,
        domain: string,
        email: string,
        interfaceLanguage: string,
        fromUserAgent?: string,
        fromUserId?: string,
        fromUserIp?: string,
    ): Promise<string>;
    searchUsersByTerm(accountId: string, term: string, options: UsersSearchByQueryOptions): Promise<UserSearchResult>;
    searchGroups(accountId: string, term: string, options: SearchOptions): Promise<UsergroupSearchResult>;
    listUserAccess(accountId: string, userId: string): Promise<UserAccess[]>;
    saveTermsAcceptance(userId: string, accountId: string, version: string): Promise<void>;
    getTermsInfo(accountId: string): Promise<ITermsInfo>;
    deleteUser(userId: string): Promise<void>;
    multiGetUsersAndGroups(
        accountId: string,
        ids: string[],
        includeDeleted?: boolean
    ): Promise<Array<User | Usergroup>>;
    insertUserTag(userTag: IUserTag, options?: InsertUserTagOptions): Promise<void>;
    getUserTags(userId: string, filter?: UserTagsFilter): Promise<IUserTag[]>;
    getUsersCreatedPerMonth(): Promise<GlobalUserCreations>;
    getAccountIdsForGroups(groupIds: string[]): Promise<Record<string, string>>;
    createUserWithCredentials(login: string, displayName: string, clearTextPassword: string, accountId?: string): Promise<User>;
    createHubspotIdentifyToken(): Promise<{ token: string, email: string }>;
    getMockedEmails(targetEmail: string): Promise<MailMessage[]>;
    syncEntraGroupMembers(accountId: string, options?: SyncEntraGroupMembersOptions): Promise<void>;
}
