import {
    Account,
    BootstrapTrialEnvironmentProps,
    ManageMemberTrigger
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { UseMutationOptions, UseQueryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { UserQuery, fetchUsers } from "../actions/users";
import { addAccountAdmin, loadAccountAdmins, removeAccountAdmin } from "./authorization";
import { validateEmailInput, validationOk } from "@binders/client/lib/clients/validation";
import type { AccountInputState } from "../pages/accounts/form";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import type { CustomerInputState } from "../pages/customers/form";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import FeaturesActions from "../actions/features";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { RECOMMENDED_FEATURES } from "../pages/accounts/featurespreset";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import config from "../config";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { getBackendRequestHandler } from "./handler";
import { loadAccountUrlToken } from "./credentials";
import { queryClient } from "../react-query";
import { useCallback } from "react";

const client = AccountServiceClient.fromConfig(config, "v1", getBackendRequestHandler());
const routingClient = RoutingServiceClient.fromConfig(config, "v1", getBackendRequestHandler());
const repoClient = BinderRepositoryServiceClient.fromConfig(config, "v3", getBackendRequestHandler());
const imageClient = ImageServiceClient.fromConfig(config, getBackendRequestHandler());
const userClient = UserServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

const getAccountQueryKey = (accountId: string) => ["accounts", "getAccount", accountId]
const getBrandingQueryKey = (brandingId: string) => ["routing", "getReaderBranding", brandingId]
const getCustomerQueryKey = (customerId: string) => ["accounts", "getCustomer", customerId]
const getDomainFilterQueryKey = (accountId: string) => ["routing", "getDomainFilter", accountId]
const getMockedEmailsQueryKey = (email: string) => ["user", "getMockedEmails", email]
const getUserAccountsQueryKey = (userId: string) => ["accounts", "getAccountsForUser", userId]
const listAccountsQueryKey = () => ["accounts", "listAccounts"];
const listAccountAdminsQueryKey = (accountId: string) => ["accounts", "accountAdmins", accountId]
const listAccountFeaturesQueryKey = (accountId: string) => ["accounts", "features", accountId]
const listAccountFeatureUsagesQueryKey = () => ["accounts", "featureUsages"]
const listBrandingsQueryKey = () => ["routing", "listBrandings"]
const listCustomersQueryKey = () => ["accounts", "listCustomers"];
const listDomainFiltersQueryKey = () => ["routing", "listDomainFilters"]
const searchUsersQueryKey = (query: UserQuery) => ["users", "searchUsers", query.searchPattern, ...(query.ids ?? [])]
const whoAmIQueryKey = () => ["whoAmI"]

const invalidate = (queryKey: string[]) => queryClient.invalidateQueries({ queryKey })

type AccountDomains = { accountId: string, domains: string[] }
type AccountFeature = { accountId: string; feature: string; }
type AccountUser = { accountId: string; userId: string; }
type AdminUserAccount = { accountId: string, adminGroupId: string; userId: string; }
type EventQueueLog = (props: { kind: EventType, accountId: string, data: Record<string, unknown>; urgent?: boolean }) => void;
type AccountCustomer = { accountId: string; customerId: string }

function useEventLog() {
    const currentUser = useWhoAmI();
    return useCallback<EventQueueLog>(({ kind, accountId, data, urgent }) => {
        eventQueue.log(
            kind,
            accountId,
            data,
            urgent,
            currentUser.data?.id,
        );
    }, [currentUser.data?.id]);
}

export function useAddAccountAdmin(options?: UseMutationOptions<unknown, Error, AdminUserAccount>) {
    return useMutation<unknown, Error, AdminUserAccount>({
        mutationFn: ({ accountId, userId, adminGroupId: groupId }) => addAccountAdmin(accountId, userId, groupId),
        onSuccess: (_, { accountId }) => {
            invalidate(listAccountAdminsQueryKey(accountId));
        },
        ...options,
    })
}

export function useAddAccountToCustomer(options?: UseMutationOptions<unknown, Error, AccountCustomer>) {
    return useMutation<unknown, Error, AccountCustomer>({
        mutationFn: ({ accountId, customerId }) => client.addAccountToCustomer(customerId, accountId),
        onSuccess: (data, props, ctx) => {
            invalidate(listCustomersQueryKey());
            invalidate(getCustomerQueryKey(props.customerId));
            invalidate(listAccountsQueryKey());
            invalidate(getAccountQueryKey(props.accountId));
            options?.onSuccess?.(data, props, ctx)
        },
        ...options,
    })
}

export function useAddAccountUser(options?: UseMutationOptions<unknown, Error, AccountUser>) {
    const eventLog = useEventLog();
    return useMutation<unknown, Error, AccountUser>({
        ...options,
        mutationFn: async ({ accountId, userId }) => client.addMember(accountId, userId, ManageMemberTrigger.MANAGE),
        onSuccess: (res, props, ctx) => {
            invalidate(listAccountAdminsQueryKey(props.accountId));
            invalidate(getAccountQueryKey(props.accountId));
            invalidate(getUserAccountsQueryKey(props.userId));
            eventLog({
                kind: EventType.USER_ADDED_TO_ACCOUNT,
                accountId: props.accountId,
                data: {
                    accountId: props.accountId,
                    userId: props.userId,
                },
            });
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useBootstrapUser(options?: UseMutationOptions<unknown, Error, BootstrapTrialEnvironmentProps>) {
    return useMutation<unknown, Error, BootstrapTrialEnvironmentProps>({
        mutationFn: props => client.bootstrapTrialEnvironment(props),
        ...options,
    });
}

export function useCreateAccount(options?: UseMutationOptions<Account, Error, AccountInputState>) {
    return useMutation<Account, Error, AccountInputState>({
        ...options,
        mutationFn: async (props) => client.createAccount(
            props.name,
            props.subscriptionType,
            props.expirationDate.toISOString(),
            props.readerExpirationDate.toISOString(),
            props.maxNumberOfLicenses,
            props.maxPublicCount,
            {
                customerId: props.selectedCustomerId,
                customerName: props.selectedCustomerName || undefined
            },
            undefined,
            RECOMMENDED_FEATURES,
            props.htmlHeadContent,
        ),
        onSuccess: (res, props, ctx) => {
            invalidate(listAccountsQueryKey());
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useCreateCustomer(options?: UseMutationOptions<unknown, Error, CustomerInputState>) {
    return useMutation<unknown, Error, CustomerInputState>({
        ...options,
        mutationFn: async (props) => client.createCustomer(
            props.name,
            props.crmCustomerId,
            props.doCreateAccount,
        ),
        onSuccess: (res, props, ctx) => {
            invalidate(listCustomersQueryKey());
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useCollectionElementsWithInfo(accountId: string, ids: string[]) {
    return useQuery({
        queryFn: () => repoClient.findItemsForEditor(
            { accountId, ids },
            {
                cdnnify: true,
                binderSearchResultOptions: {
                    maxResults: ids.length + 1,
                    summary: false,
                    omitContentModules: true,
                },
            },
            accountId,
        ),
        queryKey: ["repository", "getCollectionElementsWithInfo", accountId, ...ids],
        enabled: accountId?.length > 0 && ids?.length > 0,
    });
}

export function useCustomersList() {
    return useQuery({
        queryFn: () => client.listCustomers(),
        queryKey: ["accounts", "listCustomers"],
    });
}

export function useDeleteCustomer(options?: UseMutationOptions<unknown, Error, string>) {
    return useMutation<unknown, Error, string>({
        ...options,
        mutationFn: async customerId => client.deleteCustomer(customerId),
        onSuccess: (res, customerId, ctx) => {
            invalidate(listCustomersQueryKey());
            invalidate(getCustomerQueryKey(customerId));
            options?.onSuccess?.(res, customerId, ctx);
        },
    })
}

export function useGetAccount(accountId: string) {
    return useQuery({
        queryFn: () => client.getAccount(accountId),
        queryKey: getAccountQueryKey(accountId),
        enabled: accountId?.length > 0,
    });
}

export function useGetAccountFeaturesUsage() {
    return useQuery({
        queryFn: () => client.getAccountFeaturesUsage(),
        queryKey: listAccountFeatureUsagesQueryKey(),
    });
}

export function useGetCustomer(customerId: string) {
    return useQuery({
        queryFn: () => client.listCustomers().then(cs => cs.find(c => c.id === customerId)),
        queryKey: getCustomerQueryKey(customerId),
        enabled: customerId?.length > 0,
    });
}

export function useGetDomainFilter(accountId: string) {
    return useQuery({
        queryFn: () => routingClient.listDomainFilters().then(dfs => dfs.find(df => df.accountId === accountId)),
        queryKey: getDomainFilterQueryKey(accountId),
    })
}

export function useGetMockedEmails(email: string) {
    return useQuery({
        queryFn: () => userClient.getMockedEmails(email),
        queryKey: getMockedEmailsQueryKey(email),
        enabled: validateEmailInput(email) === validationOk,
    })
}

export function useGetReaderBranding(brandingId: string) {
    return useQuery({
        queryFn: () => routingClient.listBrandings().then(bs => bs.find(b => b.id === brandingId)),
        queryKey: getBrandingQueryKey(brandingId),
        enabled: brandingId?.length > 0,
    });
}

export function useGetUserAccounts(userId: string) {
    return useQuery({
        queryFn: () => client.getAccountsForUser(userId),
        queryKey: getUserAccountsQueryKey(userId),
        enabled: userId?.length > 0,
    });
}

export function useLinkFeature(options?: UseMutationOptions<unknown, Error, AccountFeature>) {
    return useMutation<unknown, Error, AccountFeature>({
        ...options,
        mutationFn: ({ accountId, feature }) => FeaturesActions.linkFeature(accountId, feature),
        onSuccess: (res, props, ctx) => {
            invalidate(listAccountFeaturesQueryKey(props.accountId));
            invalidate(listAccountFeatureUsagesQueryKey());
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useLinkManyAccountFeatures(options?: UseMutationOptions<unknown, Error, { accountId: string; features: string[]; }>) {
    return useMutation<unknown, Error, { accountId: string; features: string[]; }>({
        mutationFn: async ({ accountId, features }) => FeaturesActions.linkManyFeatures(accountId, features),
        ...options,
    })
}

export function useListAccountAdmins(accountId: string, options?: UseQueryOptions<Awaited<ReturnType<typeof loadAccountAdmins>>>) {
    return useQuery({
        queryFn: () => loadAccountAdmins(accountId),
        queryKey: listAccountAdminsQueryKey(accountId),
        enabled: accountId?.length > 0,
        ...options,
    });
}

export function useListAccountFeatures(accountId: string) {
    return useQuery({
        queryFn: () => client.getAccountFeatures(accountId),
        queryKey: listAccountFeaturesQueryKey(accountId),
        enabled: accountId?.length > 0,
    });
}

export function useListAccounts() {
    return useQuery({
        queryFn: () => client.listAccounts(true),
        queryKey: listAccountsQueryKey(),
    });
}

export function useListBrandings() {
    return useQuery({
        queryFn: () => routingClient.listBrandings(),
        queryKey: listBrandingsQueryKey(),
    });
}

export function useListCustomers() {
    return useQuery({
        queryFn: () => client.listCustomers(),
        queryKey: listCustomersQueryKey(),
    });
}

export function useListDomainFilters() {
    return useQuery({
        queryFn: () => routingClient.listDomainFilters(),
        queryKey: listDomainFiltersQueryKey(),
    })
}

export function useListUsers(searchPattern: string) {
    return useQuery({
        queryFn: () => fetchUsers({
            searchPattern,
        }),
        queryKey: ["users", "listUsers", searchPattern],
        enabled: searchPattern.length > 2,
    });
}

export function useFetchUser(id: string) {
    return useQuery({
        queryFn: () => userClient.getUser(id),
        queryKey: ["user", id],
        enabled: !!id,
    });
}

export function useRemoveAccountAdmin(options?: UseMutationOptions<unknown, Error, AdminUserAccount>) {
    return useMutation<unknown, Error, AdminUserAccount>({
        ...options,
        mutationFn: ({ accountId, userId, adminGroupId: groupId }) => removeAccountAdmin(accountId, userId, groupId),
        onSuccess: (res, props, ctx) => {
            invalidate(listAccountAdminsQueryKey(props.accountId));
            invalidate(getAccountQueryKey(props.accountId));
            invalidate(getUserAccountsQueryKey(props.userId));
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useRemoveAccountFromCustomer(options?: UseMutationOptions<unknown, Error, AccountCustomer>) {
    return useMutation<unknown, Error, AccountCustomer>({
        mutationFn: ({ accountId, customerId }) => client.removeAccountFromCustomer(customerId, accountId),
        onSuccess: (data, props, ctx) => {
            invalidate(listCustomersQueryKey());
            invalidate(getCustomerQueryKey(props.customerId));
            invalidate(listAccountsQueryKey());
            invalidate(getAccountQueryKey(props.accountId));
            options?.onSuccess?.(data, props, ctx)
        },
        ...options,
    })
}

export function useRemoveAccountUser(options?: UseMutationOptions<unknown, Error, AccountUser>) {
    const eventLog = useEventLog();
    return useMutation<unknown, Error, AccountUser>({
        ...options,
        mutationFn: async ({ accountId, userId }) => client.removeMember(accountId, userId, ManageMemberTrigger.MANAGE),
        onSuccess: (res, props, ctx) => {
            invalidate(listAccountAdminsQueryKey(props.accountId));
            invalidate(getAccountQueryKey(props.accountId));
            invalidate(getUserAccountsQueryKey(props.userId));
            eventLog({
                kind: EventType.USER_DELETED_FROM_ACCOUNT,
                accountId: props.accountId,
                data: {
                    accountId: props.accountId,
                    userId: props.userId,
                },
            });
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useSearchUsers(query: UserQuery, options?: UseQueryOptions<User[]>) {
    return useQuery({
        queryFn: () => fetchUsers(query),
        queryKey: searchUsersQueryKey(query),
        ...options,
    });
}

export function useSetAccountDomains(options?: UseMutationOptions<unknown, Error, AccountDomains>) {
    return useMutation<unknown, Error, AccountDomains>({
        mutationFn: ({ accountId, domains }) => routingClient.setDomainsForAccount(accountId, domains),
        onSuccess: (res, props, ctx) => {
            invalidate(listAccountsQueryKey());
            invalidate(getAccountQueryKey(props.accountId));
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useTemplateCollectionsList(accountId: string) {
    return useQuery({
        queryFn: () => repoClient.findCollections({ accountId }, { maxResults: 100 }),
        queryKey: ["repository", "findCollections", accountId],
        enabled: accountId?.length > 0,
    });
}

export function useUnlinkFeature(options?: UseMutationOptions<unknown, Error, AccountFeature>) {
    return useMutation<unknown, Error, AccountFeature>({
        ...options,
        mutationFn: ({ accountId, feature }) => FeaturesActions.unlinkFeature(accountId, feature),
        onSuccess: (res, props, ctx) => {
            invalidate(listAccountFeaturesQueryKey(props.accountId));
            invalidate(listAccountFeatureUsagesQueryKey());
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useUpdateAccount(options?: UseMutationOptions<unknown, Error, AccountInputState>) {
    return useMutation<unknown, Error, AccountInputState>({
        ...options,
        mutationFn: async (props) => client.update(
            props.account?.id,
            props.name,
            props.subscriptionType,
            props.expirationDate.toISOString(),
            props.readerExpirationDate.toISOString(),
            props.maxNumberOfLicenses,
            props.maxPublicCount,
            {
                customerId: props.selectedCustomerId,
                customerName: props.selectedCustomerName || undefined
            },
            props.htmlHeadContent,
        ),
        onSuccess: (res, props, ctx) => {
            invalidate(listAccountsQueryKey());
            invalidate(getAccountQueryKey(props.account.id))
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useUpdateCustomer(options?: UseMutationOptions<unknown, Error, CustomerInputState>) {
    return useMutation<unknown, Error, CustomerInputState>({
        ...options,
        mutationFn: async props => client.updateCustomer(
            props.customer.id,
            props.name,
            props.crmCustomerId,
        ),
        onSuccess: (res, props, ctx) => {
            invalidate(listCustomersQueryKey());
            invalidate(getCustomerQueryKey(props.customer.id))
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useCreateReaderBranding(options?: UseMutationOptions<unknown, Error, { accountId: string; branding: ReaderBranding; logoImage?: File }>) {
    return useMutation<unknown, Error, { accountId: string; branding: ReaderBranding; logoImage?: File }>({
        ...options,
        mutationFn: async props => {
            let logo = undefined;
            if (!props.branding?.stylusOverrideProps) {
                props.branding.stylusOverrideProps = {};
            }
            if (!props.branding.domain) {
                const domainFilters = await routingClient.listDomainFilters()
                const domain = domainFilters.find(filter => filter.accountId === props.accountId)
                props.branding.domain = domain.domain
            }
            if (props.logoImage) {
                logo = await imageClient.addLogo(props.accountId, props.logoImage);
            }
            await routingClient.createReaderBranding(
                { ...props.branding, logo },
                props.accountId,
            )
        },
        onSuccess: (res, props, ctx) => {
            invalidate(listBrandingsQueryKey());
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useDeleteReaderBranding(options?: UseMutationOptions<unknown, Error, ReaderBranding>) {
    return useMutation<unknown, Error, ReaderBranding>({
        ...options,
        mutationFn: async props => routingClient.deleteReaderBranding(props),
        onSuccess: (res, props, ctx) => {
            invalidate(listBrandingsQueryKey());
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useUpdateReaderBranding(options?: UseMutationOptions<unknown, Error, { accountId: string; branding: ReaderBranding; logoImage?: File }>) {
    return useMutation<unknown, Error, { accountId: string; branding: ReaderBranding; logoImage?: File }>({
        ...options,
        mutationFn: async props => {
            const logo = props.logoImage ?
                await imageClient.addLogo(props.accountId, props.logoImage) :
                undefined;

            routingClient.updateReaderBranding(
                props.branding.id,
                { ...props.branding, ...(logo ? { logo } : {}) },
            )
        },
        onSuccess: (res, props, ctx) => {
            invalidate(listBrandingsQueryKey());
            options?.onSuccess?.(res, props, ctx);
        },
    })
}

export function useWhoAmI() {
    return useQuery({
        queryFn: async () => userClient.whoAmI(),
        queryKey: whoAmIQueryKey(),
    });
}

export function useAccountUrlToken(accountId: string) {
    return useQuery({
        queryFn: () => loadAccountUrlToken(accountId),
        queryKey: ["credentials", "accountUrlToken", accountId],
        enabled: !!accountId,
    });
}
