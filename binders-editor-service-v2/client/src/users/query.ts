import {
    CredentialStatus,
    CredentialStatusForUsers
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import {
    DeviceTargetUserLink,
    MultiGetGroupMembersOptions,
    SearchOptions,
    User,
    UserType,
    Usergroup,
} from "@binders/client/lib/clients/userservice/v1/contract";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import {
    QueryKey,
    UseMutationResult,
    UseQueryResult,
    useMutation,
    useQuery,
} from "@tanstack/react-query";
import { useAccountRoles, useActiveAccountId, useIsAccountFeatureActive } from "../accounts/hooks";
import { ACTION_LIFT_USERS_ADD_NEW } from "./store";
import { APIUsersById } from "./api";
import AccountStore from "../accounts/store";
import { Acl } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import DeleteDeviceUserTargetsModal from "./Users/ManageUsers/DeleteDeviceUserTargetsModal";
import { FEATURE_DEVICE_USER_IMPERSONATION } from "@binders/client/lib/clients/accountservice/v1/contract";
import { FlashMessages } from "../logging/FlashMessages";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { assignRole } from "./actions";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { queryClient } from "../application";
import { removeUserFromAccount } from "./tsActions";
import { setCurrentUserDetails } from "../stores/my-details-store";
import { showModal } from "@binders/ui-kit/lib/compounds/modals/showModal";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const userServiceName = "@binders/users-v1";
export const credentialServiceName = "@binders/credentials-v1";

const accountIdProvider = AccountStore.getActiveAccountId.bind(AccountStore);
const credentialService = CredentialServiceClient.fromConfig(config, "v1", browserRequestHandler);
const userService = UserServiceClient.fromConfig(config, "v1", browserRequestHandler, accountIdProvider);

export function invalidateQuery(queryKey: QueryKey) {
    queryClient.invalidateQueries(queryKey);
}

const getMyDetailsQueryKey = () => [userServiceName, "myDetails"];
export function useGetMyDetails() {
    return useQuery({
        queryKey: getMyDetailsQueryKey(),
        queryFn: async () => {
            const myDetails = await userService.myDetails()
            setCurrentUserDetails(myDetails);
            return myDetails;
        },
    });
}

const getUserPreferencesKey = (userId?: string) => [userServiceName, "preferences", userId ?? "unknown"];
export function useGetUserPreferences(userId?: string) {
    return useQuery({
        queryKey: getUserPreferencesKey(userId),
        queryFn: () => userService.getPreferences(userId),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        enabled: !!userId
    });
}

export const useSetAllowAnalyticsCookies = (): UseMutationResult<void, Error> => {
    return useMutation(
        async (params: { userId: string; acknowledgementCookies: boolean }) => {
            await userService.savePreferences(params.userId, { acknowledgementCookies: params.acknowledgementCookies })
        },
        {
            onSuccess: async (_data, params) => {
                queryClient.invalidateQueries(getUserPreferencesKey(params.userId));
                queryClient.invalidateQueries(getMyDetailsQueryKey());
            }
        }
    );
}

export function useSaveTermsAcceptance() {
    return useMutation({
        mutationFn: (params: {
            userId: string;
            accountId: string;
            version: string;
        }) => userService.saveTermsAcceptance(params.userId, params.accountId, params.version),
        onSuccess: (_data, params) => {
            queryClient.invalidateQueries({
                predicate: query => query.queryKey.at(0) === userServiceName && query.queryKey.includes(params.userId),
            });
        },
    });
}

export function useSetDefaultAnalyticsRange() {
    return useMutation({
        mutationFn: (params: {
            userId: string;
            defaultAnalyticsRange: string;
        }) => userService.savePreferences(params.userId, { defaultAnalyticsRange: params.defaultAnalyticsRange }),
        onSuccess: (_data, params) => {
            queryClient.invalidateQueries(getUserPreferencesKey(params.userId));
            queryClient.invalidateQueries(getMyDetailsQueryKey());
        },
    });
}

const getUsersKey = (userIds: string[]) => [userServiceName, "getUsers", ...userIds.sort()];
export const useUsers = (
    userIds: string[],
): UseQueryResult<User[], Error> => {
    return useQuery({
        queryKey: getUsersKey(userIds),
        queryFn: () => {
            if (userIds.length === 0) return [];
            return userService.getUsers(userIds);
        },
    });
}

const getUsersAndGroupsKey = (userAndGroupIds?: string[]) => [userServiceName, "multiGetUsersAndGroups", ...(userAndGroupIds ?? ["unknown"]).sort()];
export const useUsersAndGroups = (
    userAndGroupIds?: string[],
): UseQueryResult<(User | Usergroup)[]> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryKey: getUsersAndGroupsKey(userAndGroupIds),
        queryFn: async () => {
            if (!userAndGroupIds?.length) return [];
            return userService.multiGetUsersAndGroups(accountId, userAndGroupIds);
        },
        enabled: userAndGroupIds != null
    });
}

const getManageableGroupsKey = () => [userServiceName, "getManageableGroups_manageableUserGroups"];
export const useManageableUserGroups = (): UseQueryResult<Usergroup[]> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryKey: getManageableGroupsKey(),
        queryFn: () => userService.getManageableGroups(accountId, undefined),
    });
}

export const useGroupOwnersUpdate = (): UseMutationResult<void, Error> => {
    const { t } = useTranslation();
    const accountId = useActiveAccountId();
    return useMutation({
        mutationFn: async (params: { groupId: string, ownerUserIds: string[] }) =>
            userService.updateGroupOwners(accountId, params.groupId, params.ownerUserIds),
        onSuccess: () => queryClient.invalidateQueries(getManageableGroupsKey()),
        onError() { FlashMessages.error(t(TK.User_GroupOwners_UpdateError))},
    });
}

const getUserCredentialStatuses = (userIds: string[]) => [userServiceName, "getCredentialStatusForUsers", ...userIds];
export const useUserCredentialStatuses = (userIds: string[]): UseQueryResult<CredentialStatusForUsers> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryKey: getUserCredentialStatuses(userIds),
        queryFn: async () => {
            if (userIds.length === 0) {
                return {};
            }
            return credentialService.getCredentialStatusForUsers(accountId, userIds);
        },
        enabled: userIds != null,
        initialData: {},
    });
};

export const useOnUpdatePasswordForUser = (userId: string, setPasswordFn: (pass: string) => Promise<void>): UseMutationResult<void, Error> => {
    return useMutation({
        mutationFn: setPasswordFn,
        onSuccess: () => {
            const userCredentialStatusUpdater = (credentialStatuses: CredentialStatusForUsers) => {
                const userCredentialStatus = credentialStatuses[userId];
                if (userCredentialStatus == null || userCredentialStatus === CredentialStatus.PASSWORD_SET) {
                    return credentialStatuses;
                }
                return {
                    ...credentialStatuses,
                    [userId]: CredentialStatus.PASSWORD_SET
                };
            };
            queryClient.setQueriesData(getUserCredentialStatuses([]), userCredentialStatusUpdater);
        },
    });
};

export const useCreateUserWithCredentials = (
    successCallback: () => void,
): UseMutationResult<User, Error> => {
    const accountId = useActiveAccountId();
    const accountRoles = useAccountRoles();
    const { t } = useTranslation();

    return useMutation(
        async (params: {
            login: string,
            password: string,
            name: string,
            roleName: string,
            acls: Acl[],
        }) => {
            const user = await userService.createUserWithCredentials(params.login, params.name, params.password);
            await assignRole(params.roleName, user.id, params.acls, accountId, accountRoles);
            captureFrontendEvent(EditorEvent.UserManagementCreateWithCredentials, { roleName: params.roleName });
            return user;
        },
        {
            onSuccess: (user: User) => {
                dispatch({
                    type: ACTION_LIFT_USERS_ADD_NEW,
                    body: [user]
                });
                FlashMessages.info(t(TK.User_AddUserSuccess));
                if (successCallback) {
                    successCallback();
                }
            }
        }
    );
}

export const getAccountUsergroupsKey = (accountId: string) => [userServiceName, "getManageableGroups_accountUsergroupsKey", accountId];
function useGetAccountUsergroups(accountId: string) {
    return useQuery({
        queryFn: () => userService.getManageableGroups(accountId, undefined, {
            includeAccountAdminGroup: true,
            includeAutoManagedGroups: true,
        }),
        queryKey: getAccountUsergroupsKey(accountId),
        enabled: !!accountId,
    });
}

export function useGetAccountUsergroupsIncludingAutoManaged() {
    const accountId = useActiveAccountId();
    return useGetAccountUsergroups(accountId);
}

export function useGetAccountUsergroupsExcludingAutoManaged() {
    const accountId = useActiveAccountId();
    const ugs = useGetAccountUsergroups(accountId);
    return {
        ...ugs,
        data: ugs.data ? ugs.data.filter(ug => !ug.isAutoManaged) : ugs.data,
    };
}

export const getMappedUserGroupsKey = (accountId: string) => [credentialServiceName, "getAllADGroupMappings", accountId];
export function useGetMappedUserGroups(accountId: string) {
    return useQuery({
        queryFn: () => credentialService.getAllADGroupMappings(accountId),
        queryKey: getMappedUserGroupsKey(accountId),
        enabled: !!accountId,
    });
}

export function useAddGroupMember() {
    const { t } = useTranslation();
    return useMutation({
        mutationFn: async (props: {
            accountId: string,
            userGroupId: string,
            userId: string,
            groupName: string
        }) => {
            await userService.addGroupMember(props.accountId, props.userGroupId, props.userId)
            captureFrontendEvent(EditorEvent.UserManagementAddGroupMember, { groupName: props.groupName });
        },
        onSuccess(_, variables) {
            invalidateQuery(getGroupMembersKey(variables.accountId, variables.userGroupId))
        },
        onError() { FlashMessages.error(t(TK.User_Groups_AddMemberError)) },
    });
}

export function useRemoveGroupMember() {
    const { t } = useTranslation();
    return useMutation({
        async mutationFn(props: {
            accountId: string,
            userGroupId: string,
            userId: string,
            groupName: string
        }) {
            await userService.removeGroupMember(props.accountId, props.userGroupId, props.userId);
            captureFrontendEvent(EditorEvent.UserManagementRemoveGroupMember, { groupName: props.groupName });
        },
        onSuccess(_, variables) {
            invalidateQuery(getGroupMembersKey(variables.accountId, variables.userGroupId))
        },
        onError() { FlashMessages.error(t(TK.User_CantRemoveGroupMember)) },
    });
}

const getGroupMembersKey = (accountId: string, usergroupId: string) => [userServiceName, "getGroupMembers", accountId, usergroupId];
export function useGetGroupMembers(
    accountId: string,
    usergroupId: string,
    options: SearchOptions = { orderBy: "name" },
) {
    return useQuery({
        queryFn: async () => userService.getGroupMembers(accountId, usergroupId, options),
        queryKey: getGroupMembersKey(accountId, usergroupId),
    });
}

export const getMembersFromAllGroups = (accountId: string, groupIds: string[]) => [userServiceName, "multiGetGroupMembers", accountId, ...groupIds.sort()];
export function useGetMembersFromAllGroups(
    accountId: string,
    groupIds: string[],
    options?: MultiGetGroupMembersOptions,
) {
    return useQuery({
        queryFn: async () => userService.multiGetGroupMembers(accountId, groupIds, options),
        queryKey: getMembersFromAllGroups(accountId, groupIds),
        enabled: groupIds.length > 0,
    });
}

export function useUpdateUsergroup() {
    const { t } = useTranslation();
    return useMutation({
        async mutationFn(props: {
            accountId: string;
            groupId: string;
            name: string;
        }) {
            await userService.updateGroupName(props.accountId, props.groupId, props.name);
            captureFrontendEvent(EditorEvent.UserManagementUpdateGroup, { name: props.name });
        },
        onSuccess(_, variables) {
            invalidateQuery(getAccountUsergroupsKey(variables.accountId));
        },
        onError() { FlashMessages.error(t(TK.User_Groups_UpdateError)) },
    });
}

export function useCreateUsergroup() {
    const { t } = useTranslation();
    return useMutation({
        async mutationFn(props: {
            accountId: string;
            name: string;
        }) {
            const ug = await userService.createGroup(props.accountId, props.name);
            captureFrontendEvent(EditorEvent.UserManagementCreateGroup, { name: props.name });
            return ug;
        },
        onSuccess(_, variables) {
            invalidateQuery(getAccountUsergroupsKey(variables.accountId));
        },
        onError() { FlashMessages.error(t(TK.User_Groups_CreateError)) }
    });
}

export function useDeleteUsergroup() {
    const { t } = useTranslation();
    return useMutation({
        async mutationFn(props: {
            accountId: string;
            groupId: string;
        }) {
            await userService.removeGroup(props.accountId, props.groupId);
            captureFrontendEvent(EditorEvent.UserManagementDeleteGroup);
        },
        onSuccess(_, variables) {
            invalidateQuery(getAccountUsergroupsKey(variables.accountId));
        },
        onError() { FlashMessages.error(t(TK.User_Groups_DeleteError)) }
    });
}

const getGroupsForUserKey = (userId: string, accountId: string) => [userServiceName, "getGroupsForUser", userId, accountId];
export function useGetGroupsForUser(userId: string, accountId: string) {
    return useQuery({
        queryFn: async () => userService.getGroupsForUser(userId, accountId),
        queryKey: getGroupsForUserKey(userId, accountId),
    });
}

export function getGroupsForUsers(userIds: string[], accountId: string) {
    return userService.getGroupsForUsers(userIds, accountId);
}

export function invalidateAllGroupQueries() {
    const isSameQueryKeyPrefix = (q1: QueryKey, q2: QueryKey) => q1.at(0) === q2.at(0) && q1.at(1) === q2.at(1);
    queryClient.invalidateQueries({
        predicate: q =>
            isSameQueryKeyPrefix(getAccountUsergroupsKey(""), q.queryKey) ||
            isSameQueryKeyPrefix(getGroupMembersKey("", ""), q.queryKey) ||
            isSameQueryKeyPrefix(getGroupsForUserKey("", ""), q.queryKey) ||
            isSameQueryKeyPrefix(getManageableGroupsKey(), q.queryKey) ||
            isSameQueryKeyPrefix(getMembersFromAllGroups("", []), q.queryKey) ||
            isSameQueryKeyPrefix(getUsersAndGroupsKey(), q.queryKey),
    });
}

const getAccountDeviceTargetUserLinksKey = (accountId: string) => [userServiceName, "getDeviceTargetUserLinks", accountId];
export function useGetAccountDeviceTargetUserLinks(accountId: string) {
    const hasFeature = useIsAccountFeatureActive(FEATURE_DEVICE_USER_IMPERSONATION);
    return useQuery({
        queryFn: async () => userService.getDeviceTargetUserLinks(accountId),
        queryKey: getAccountDeviceTargetUserLinksKey(accountId),
        enabled: accountId && hasFeature,
    });
}

export function useParentDeviceUserIds(user: User) {
    const accountId = useActiveAccountId();
    const deviceTargetUserLinks = useGetAccountDeviceTargetUserLinks(accountId);
    const parentDeviceUserIds = deviceTargetUserLinks.data
        ?.filter(deviceUser => deviceUser.resolvedUserIds.includes(user.id))
        ?.map(du => du.deviceUserId);
    return parentDeviceUserIds ?? [];
}

export function useIsDeviceUserTarget(user: User) {
    const accountId = useActiveAccountId();
    const deviceTargetUserLinks = useGetAccountDeviceTargetUserLinks(accountId);
    return isDeviceUserTarget(user, deviceTargetUserLinks.data);
}

export function isDeviceUserTarget(user: User, deviceTargetUserLinks: DeviceTargetUserLink[] | undefined) {
    const parentDeviceUserIds = deviceTargetUserLinks
        ?.filter(deviceUser => deviceUser.resolvedUserIds.includes(user.id))
        ?.map(du => du.deviceUserId);
    const parentIds = parentDeviceUserIds ?? [];
    return parentIds.length > 0;
}

export function useAssignDeviceTargetUsers() {
    return useMutation({
        mutationFn: async (vars: {
            accountId: string;
            deviceUserId: string;
            userAndGroupIds: string[];
            usergroupIntersections?: string[][];
        }) => {
            await userService.assignDeviceTargetUsers(
                vars.accountId,
                vars.deviceUserId,
                vars.userAndGroupIds,
                vars.usergroupIntersections ?? [],
            );
        },
        onSuccess(_, vars) {
            invalidateQuery(getAccountDeviceTargetUserLinksKey(vars.accountId));
        }
    })
}

export function useRemoveDeviceTargets(accountId: string) {
    const deviceTargetUserLinks = useGetAccountDeviceTargetUserLinks(accountId);
    return useMutation({
        mutationFn: async (props: {
            accountId: string,
            user: User,
            myUser: User,
            deviceTargetUserIdsOfRemovedUser: string[]
        }) => {
            if (`${props.user.type}` !== `${UserType.Device}`) {
                return [];
            }
            // filter out the ones that are assigned to just one device
            const orphanedUserIds = props.deviceTargetUserIdsOfRemovedUser.filter(userId => (
                deviceTargetUserLinks.data?.filter(link => link.userIds.includes(userId)).length === 1
            ));
            const orphanedUsers = await APIUsersById(orphanedUserIds, true);
            // retain the passwordless ones
            const orphanedPasswordlessUsers = orphanedUsers.filter(u => u.isPasswordless);
            if (!(orphanedPasswordlessUsers?.length)) {
                return [];
            }
            const shouldRemove = await showModal(DeleteDeviceUserTargetsModal, { users: orphanedPasswordlessUsers });
            if (shouldRemove) {
                await Promise.all(orphanedPasswordlessUsers.map(user => removeUserFromAccount(accountId, user.id, props.myUser)));
                return orphanedPasswordlessUsers.map(u => u.id);
            }
            return [];
        },
        onSuccess(_, vars) {
            invalidateQuery(getAccountDeviceTargetUserLinksKey(vars.accountId));
        }
    });
}
