import * as crypto from "crypto";
import {
    ACCOUNT_SERVICE_CACHE_OPTIONS,
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendImageServiceClient,
    BackendNotificationServiceClient,
    BackendRepoServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    AG5Settings,
    ALL_USERS_GROUP,
    AccountNotFound,
    AccountServiceContract,
    BootstrapTrialEnvironmentProps,
    Account as ClientAccount,
    CreateMSAccountSetupRequestParams,
    FEATURE_CEVA,
    FEATURE_GROUP_OWNERS,
    FEATURE_NOCDN,
    FEATURE_USERTOKEN_LOGIN,
    IAccountFilter,
    IAccountMembership,
    IAccountSettings,
    IAccountStorageDetails,
    ICustomer,
    ICustomerInfo,
    ICustomersQuery,
    IFeature,
    IGetAccountOptions,
    ILanguageAccountSettings,
    IMSAccountSetupRequest,
    IMSTransactableSubscription,
    IMTAccountSettings,
    IPDFExportAccountSettings,
    IPublicAccountSettings,
    ISAMLSSOSettings,
    IUpdateFeaturesOptions,
    IVisualsAccountSettings,
    MSTransactableOffersFullfillmentWebhookData,
    MSTransactableSubscriptionNotFound,
    ManageMemberTrigger,
    ResolveMSPurchaseIdTokenResponse,
    SecuritySettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    Account,
    AccountIdentifier,
    AccountLicensing,
    AccountSettings,
    Customer,
    CustomerIdentifier,
    MSTransactableSubscription,
    SubscriptionTypes
} from "./model";
import {
    AccountFeaturesRepository,
    MongoAccountFeaturesRepositoryFactory
} from "./repositories/accountFeatures";
import {
    AccountLicensingRepository,
    MongoLicensingRepositoryFactory
} from "./repositories/licensing";
import {
    AccountMembershipRepository,
    MongoAccountMembershipRepositoryFactory
} from "./repositories/accountMemberships";
import {
    AccountPermission,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AccountRepository, MongoAccountRepositoryFactory } from "./repositories/accounts";
import {
    AccountSettingsRepository,
    MongoAccountSettingsRepositoryFactory
} from "./repositories/settings";
import {
    AccountSortMethod,
    FEATURE_BROWSER_LOGO_FAVICON,
    IFeatureUsage
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    AuthenticatedSession,
    EntityNotFound,
    Unauthorized
} from "@binders/client/lib/clients/model";
import {
    BindersRepositoryServiceContract,
    IThumbnail,
    MTEngineType
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { CustomerRepository, MongoCustomerRepositoryFactory } from "./repositories/customers";
import {
    IMSTransactableOffersApi,
    MSTransactableOffersApiFactory
} from "@binders/binders-service-common/lib/mstransactableoffers";
import { JWTSignConfig, buildSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    MSAccountSetupRequestsRepository,
    MongoMSAccountSetupRequestsRepositoryFactory
} from "./repositories/ms_transactables/msAccountSetupRequests";
import {
    MSTransactableEventRepository,
    MongoMSTransactableEventsRepositoryFactory
} from "./repositories/ms_transactables/msTransactableEvents";
import {
    MSTransactableSubscriptionsRepository,
    MongoMSTransactableSubscriptionsRepositoryFactory
} from "./repositories/ms_transactables/msTransactableSubscriptions";
import { RedisClient, RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import {
    ServerEvent,
    captureServerEvent,
    updatePosthogAccountProperties
} from "@binders/binders-service-common/lib/tracking/capture";
import { addWeeks, isAfter } from "date-fns";
import {
    transactableEventFromOperation,
    transactableEventFromSetupRequest
} from "./ms_transactable/helpers";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { AccountServiceMailer } from "./mailer/mailer";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { Config } from "@binders/client/lib/config/config";
import {
    CredentialServiceContract
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import { FeaturesByAccount } from "@binders/client/lib/clients/accountservice/v1/contract";
import ImageFormatsTransformer from "@binders/binders-service-common/lib/itemstransformers/ImageFormats";
import { ImageServiceContract } from "@binders/client/lib/clients/imageservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { MSAccountSetupRequest } from "./model";
import {
    NotificationServiceClient
} from "@binders/client/lib/clients/notificationservice/v1/client";
import { RedisCacheBuilder } from "@binders/binders-service-common/lib/cache/redis";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { bootstrapTrialEnvironment } from "./trial/bootstrapTrialEnv";
import {
    getAccountsPermissionFlags
} from "@binders/binders-service-common/lib/authorization/helpers";
import {
    getOrCreateLaunchDarklyService
} from "@binders/binders-service-common/lib/persistentcache/helpers/singletonDependencies";
import { isUsergroupId } from "@binders/client/lib/clients/userservice/v1/helpers";
import { isValidHtml } from "@binders/binders-service-common/lib/html/validation";
import { partition } from "ramda";

const BINDERS_ACCOUNT_ID = "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6";

class MSPurchaseIdTokenAlreadyKnown extends Error {
    constructor(token: string) {
        super(`Microsoft transactable offers: PurchaseIdToken already known: ${token}`);
        this.name = "MSPurchaseIdTokenAlreadyKnown";
    }
}

class MSTokenBelongsToActiveAccount extends Error {
    constructor(token: string) {
        super(`Microsoft transactable offers: The provided PurchaseIdToken belongs to an already active account: ${token}`);
        this.name = "MSTokenBelongsToActiveAccount";
    }
}

class MSSubscriptionIdNotLinkedToAccount extends Error {
    constructor(subscriptionId: string) {
        super(`Microsoft transactable offers: The given subscription id is not linked to an account: "${subscriptionId}""`);
        this.name = "MSSubscriptionIdNotLinkedToAccount";
    }
}

export class MSSubscriptionAlreadyExists extends Error {
    constructor(subscriptionId: string) {
        super(`Microsoft transactable offers: The given subscription id "${subscriptionId}" is already linked to an account.`);
        this.name = "MSSubscriptionAlreadyExists";
    }
}

export class MSSetupRequestNotFound extends Error {
    constructor(identifier: string, identifierName = "subscriptionId") {
        super(`Microsoft transactable offers: Setup request not found using "${identifierName}" with value "${identifier}"`);
        this.name = "MSSetupRequestNotFound";
    }
}

function toClientAccount(account: Account, licensing: AccountLicensing, htmlHeadContent?: string): ClientAccount {
    return {
        id: account.id.value(),
        name: account.name,
        members: account.members.map(member => member.value()),
        subscriptionType: SubscriptionTypes.toStringUnsafe(account.subscriptionType),
        subscriptionId: account.subscriptionId,
        accountIsNotExpired: account.accountIsNotExpired,
        expirationDate: account.expirationDate.toISOString(),
        readerExpirationDate: account.readerExpirationDate && account.readerExpirationDate.toISOString(),
        maxNumberOfLicenses: licensing && licensing.maxNumberOfLicenses,
        maxPublicCount: licensing && licensing.maxPublicCount,
        amIAdmin: account.amIAdmin,
        domains: account.domainFilters.map(domainFilter => domainFilter.domain),
        thumbnail: account.thumbnail,
        rootCollectionId: account.rootCollectionId,
        created: account.created,
        storageDetails: account.storageDetails,
        isAnonymised: account.isAnonymised,
        htmlHeadContent,
    };
}

function toClientCustomer(customer: Customer): ICustomer {
    return {
        id: customer.id.value(),
        name: customer.name,
        crmCustomerId: customer.crmCustomerId,
        accountIds: customer.accountIds.map(accountId => accountId.value()),
        created: customer.created,
    };
}

export class AccountService implements AccountServiceContract {
    private helpAccount: ClientAccount;

    constructor(
        private accountRepository: AccountRepository,
        private customerRepository: CustomerRepository,
        private accountSettingsRepository: AccountSettingsRepository,
        private accountFeaturesRepository: AccountFeaturesRepository,
        private accountLicensingRepository: AccountLicensingRepository,
        private accountMembershipRepository: AccountMembershipRepository,
        private msAccountSetupRequestsRepository: MSAccountSetupRequestsRepository,
        private msTransactableEventsRepository: MSTransactableEventRepository,
        private msTransactableSubscriptionsRepository: MSTransactableSubscriptionsRepository,
        private msTransactableOffersApi: IMSTransactableOffersApi,
        private authorizationContract: AuthorizationServiceClient,
        private userContract: UserServiceClient,
        private credentialServiceContract: CredentialServiceContract,
        private repoServiceClient: BindersRepositoryServiceContract,
        private routingServiceClient: RoutingServiceContract,
        private imageServiceClient: ImageServiceContract,
        private notificationServiceClient: NotificationServiceClient,
        private readonly jwtConfig: JWTSignConfig,
        private flushingAccountClient: AccountServiceClient,
        private logger: Logger,
        private readonly mailer: AccountServiceMailer,
        private readonly launchDarkly: LaunchDarklyService,
    ) { }

    private async extendAccounts(accounts: Account[], options?: { includeHtmlHeadContent?: boolean }): Promise<ClientAccount[]> {
        const accountIds = accounts.map(account => account.id.value());
        const licenses = await this.accountLicensingRepository.findLicensingForAccounts(accountIds);
        const accountSettings = options?.includeHtmlHeadContent && await this.accountSettingsRepository.multiGetAccountSettings(accountIds);
        return accounts.map(acc => {
            const licensing = licenses.find(license => license.accountId === acc.id.value());
            const settings = accountSettings && accountSettings[acc.id.value()];
            return toClientAccount(acc, licensing, options?.includeHtmlHeadContent && settings?.getHtmlHeadContent());
        });
    }

    async listAccounts(includeHtmlHeadContent = false): Promise<Array<ClientAccount>> {
        const accounts = await this.accountRepository.listAccounts();
        const accountIds = accounts.map(account => account.id.value());
        const domainFilters = await this.routingServiceClient.getDomainFiltersForAccounts(accountIds);

        for (const account of accounts) {
            account.domainFilters = domainFilters.filter(df => df.accountId === account.id.value());
            account.accountIsNotExpired = this.isAccountNotExpired(account);
        }
        return this.extendAccounts(accounts, { includeHtmlHeadContent });
    }

    private isAccountNotExpired(account: Account): boolean {
        return isAfter(account.expirationDate, Date.now());
    }

    async findAccounts(filter: IAccountFilter): Promise<Array<ClientAccount>> {
        const accounts = await this.accountRepository.findAccounts(filter);
        return this.extendAccounts(accounts);
    }

    async createAccount(
        name: string,
        subscriptionType: string,
        expirationDate: string,
        readerExpirationDate: string,
        maxNumberOfLicenses: number,
        maxPublicCount: number,
        customerInfo: ICustomerInfo,
        id?: string,
        features?: string[],
        htmlHeadContent?: string,
        userId?: string
    ): Promise<ClientAccount> {
        const subscription = SubscriptionTypes.toEnumUnsafe(subscriptionType);
        const expiresWhen = new Date(expirationDate);
        const readerExpiresWhen = new Date(readerExpirationDate);
        const newAccount = Account.create(
            name,
            subscription,
            expiresWhen,
            readerExpiresWhen,
            id,
        );
        const account = await this.accountRepository.saveAccount(newAccount);
        const accountId = account.id.value();

        const collection = await this.repoServiceClient.createRootCollection(accountId, account.name);
        await this.accountFeaturesRepository.createAccountFeatures(accountId);
        if (features) {
            await this.setAccountFeatures(accountId, features);
        }

        await this.authorizationContract.createDefaultAccountRoles(accountId, collection.id);
        const [adminusergroup] = await this.userContract.multiAddGroupMembers(
            accountId,
            {
                names: [
                    "Account admins",
                ]
            },
            [
                userId,
            ],
            {
                createGroupIfDoesntExist: true,
                makeNewUsergroupReadonly: true,
            },
        );
        await this.authorizationContract.addAccountAdminUserGroup(accountId, adminusergroup.id);
        await this.addMember(accountId, userId, ManageMemberTrigger.MANAGE, true);

        const licensing = new AccountLicensing(accountId, 0, maxPublicCount || null, 1, maxNumberOfLicenses);
        await this.accountLicensingRepository.saveLicensing(licensing);
        await this.updateAccountMemberships(accountId, []);

        if (customerInfo && Object.keys(customerInfo).length) {
            await this.handleCreateAccordingCustomer(accountId, customerInfo, userId);
        }

        if (htmlHeadContent !== undefined) {
            if (!isValidHtml(htmlHeadContent)) {
                this.logger.error(`invalid html provided in createAccount: ${htmlHeadContent}`, "createAccount");
                return toClientAccount(account, licensing);
            }
            const settings = await this.accountSettingsRepository.getAccountSettings(accountId);
            const updatedSettings = (<AccountSettings>settings).setHtmlHeadContent(htmlHeadContent);
            await this.accountSettingsRepository.saveAccountSettings(accountId, updatedSettings.settings);
        }

        updatePosthogAccountProperties(account.id.value(), {
            name: account.name,
            membersCount: account.members.length,
            totalLicenses: licensing?.totalLicenses,
            maxNumberOfLicenses: licensing?.maxNumberOfLicenses,
            totalPublicDocuments: licensing?.totalPublicDocuments,
            maxPublicCount: licensing?.maxPublicCount,
            createdAt: account.created,
            expirationDate: account.expirationDate,
            readerExpirationDate: account.readerExpirationDate,
            domain: account.domainFilters?.at(0)?.domain,
            rootCollectionId: collection.id
        }
        );
        return toClientAccount(account, licensing, htmlHeadContent);
    }

    async deleteAccount(accountId: string): Promise<void> {
        if (accountId == null) throw new Error("AccountId is null");
        const account = await this.accountRepository.getAccount(new AccountIdentifier(accountId));
        if (account == null) throw new Error("Account not found");
        await this.accountFeaturesRepository.deleteAccountFeatures(accountId);
        await this.accountLicensingRepository.deleteLicensing(accountId);
        await this.accountMembershipRepository.deleteAccountMembership(accountId);
        await this.accountRepository.deleteAccount(new AccountIdentifier(accountId), true);
    }

    private async handleCreateAccordingCustomer(accountId: string, customerInfo: ICustomerInfo, userId: string) {
        let customerId = customerInfo?.customerId; // if the customer already exists
        const customerName = customerInfo?.customerName; // if we need to create a new customer
        if (!customerId && customerName) {
            const customer = await this.createCustomer(customerName, undefined, false, userId);
            customerId = customer.id;
        }
        await this.deleteAccountFromAllCustomers(accountId);
        await this.addAccountToCustomer(customerId, accountId);
    }

    private async addUsersToAllUsers(accountId: string, userIds: string[]) {
        await this.userContract.multiAddGroupMembers(
            accountId,
            {
                names: [ALL_USERS_GROUP]
            },
            userIds,
            {
                createGroupIfDoesntExist: true,
                makeNewUsergroupReadonly: true,
                makeNewUsergroupAutoManaged: true,
            }
        )
    }

    getAccount(accountId: string): Promise<ClientAccount> {
        return AccountIdentifier.build(accountId).caseOf({
            left: error => Promise.reject<ClientAccount>(error),
            right: async accountIdObject => {
                const account = await this.accountRepository.getAccount(accountIdObject);
                const [clientAccount] = await this.extendAccounts([account]);
                return clientAccount;
            }
        });
    }

    private withAccountId<T>(accountId: string, f: (accountIdentifier: AccountIdentifier) => Promise<T>): Promise<T> {
        return AccountIdentifier.build(accountId).caseOf({
            left: error => Promise.reject<T>(error),
            right: accountIdObject => f(accountIdObject)
        });
    }

    private withCustomerId<T>(customerId: string, f: (customerIdentifier: CustomerIdentifier) => Promise<T>): Promise<T> {
        return CustomerIdentifier.build(customerId).caseOf({
            left: error => Promise.reject<T>(error),
            right: customerIdObject => f(customerIdObject)
        });
    }

    private withUserId<T>(userId: string, f: (userIdentifier: UserIdentifier) => Promise<T>): Promise<T> {
        return UserIdentifier.build(userId).caseOf({
            left: error => Promise.reject<T>(error),
            right: userIdObject => f(userIdObject)
        });
    }

    private withUserIds(userIds: string[]): Promise<Array<UserIdentifier>> {
        return Promise.all(
            userIds.map(id =>
                this.withUserId<UserIdentifier>(id, async (userIdObject) => userIdObject)
            )
        );
    }

    private withAccountIdAndUserId<T>(
        accountIdString: string,
        userIdString: string,
        f: (aid: AccountIdentifier, uid: UserIdentifier) => Promise<T>
    ): Promise<T> {
        return this.withAccountId(accountIdString, accountId => {
            return this.withUserId(userIdString, userId => {
                return f(accountId, userId);
            });
        });
    }

    private withCustomerIdAndAccountId<T>(
        customerIdString: string,
        accountIdString: string,
        f: (cid: CustomerIdentifier, aid: AccountIdentifier) => Promise<T>
    ): Promise<T> {
        return this.withCustomerId(customerIdString, customerId => {
            return this.withAccountId(accountIdString, accountId => {
                return f(customerId, accountId);
            });
        });
    }

    private async getAllManualToUserIds(): Promise<Set<string>> {
        const result = await this.userContract.searchUsersBackend({ login: ".*@manual.to$" }, {});
        return new Set(result.hits.map(u => u.id));
    }

    private async updateAccountTotalLicenses(accountId: string, members: UserIdentifier[]) {
        const [licensing] = await this.accountLicensingRepository.findLicensingForAccounts([accountId]);
        const totalLicenses = accountId === BINDERS_ACCOUNT_ID ?
            members.length :
            (await this.countUsersByType(members)).regularUsersCount
        await this.accountLicensingRepository.updateLicensing({
            ...licensing,
            totalLicenses,
        });
    }

    private async updateAccountMemberships(accountId: string, users: UserIdentifier[]): Promise<void> {
        const { manualToUsersCount, regularUsersCount } = await this.countUsersByType(users);
        await this.accountMembershipRepository.updateMemberCount(accountId, regularUsersCount, manualToUsersCount);
    }

    private async countUsersByType(users: UserIdentifier[]): Promise<{ manualToUsersCount: number, regularUsersCount: number }> {
        const allManualToUserIds = users.length === 0 ? new Set<string>() : await this.getAllManualToUserIds();
        const [manualToMembers, regularMembers] = partition(userId => allManualToUserIds.has(userId.value()), users);
        return {
            manualToUsersCount: manualToMembers.length,
            regularUsersCount: regularMembers.length
        };
    }

    async addMember(
        accountId: string,
        userId: string,
        _manageMemberTrigger: ManageMemberTrigger,
        skipDefaultPermissions?: boolean,
        fromUserId?: string,
        fromUserIp?: string | string[],
        fromUserAgent?: string,
    ): Promise<ClientAccount> {
        await this.addUsersToAllUsers(accountId, [userId]);
        return this.withAccountIdAndUserId(accountId, userId, async (accountIdObject, userIdObject) => {
            const account = await this.accountRepository.getAccount(accountIdObject);
            account.members = account.members.filter(member => member.value() !== userId);
            account.members.push(userIdObject);
            const savedAccount = await this.accountRepository.saveAccount(account);
            if (!skipDefaultPermissions) {
                await this.authorizationContract.addUserToAccount(
                    accountId,
                    userId,
                    fromUserId,
                    fromUserIp,
                    fromUserAgent,
                );
            }

            await this.updateAccountTotalLicenses(accountId, account.members);
            await this.updateAccountMemberships(accountId, account.members);
            const [clientAccount] = await this.extendAccounts([savedAccount]);
            captureServerEvent(ServerEvent.AccountMemberAdded, { accountId, userId: fromUserId }, { userId });
            return clientAccount;
        });
    }

    async addMembers(
        accountIdString: string,
        userIds: string[],
        _manageMemberTrigger: ManageMemberTrigger,
        fromUserId?: string,
        _fromUserIp?: string | string[],
        _fromUserAgent?: string,
    ): Promise<ClientAccount[]> {
        return this.withAccountId(accountIdString, async (accountIdentifier) => {
            const userIdObjects = await this.withUserIds(userIds)
            const account = await this.accountRepository.getAccount(accountIdentifier)
            const newUidValues = userIdObjects.filter(uidValue => {
                return account.members.find(m => m.value() === uidValue.value()) === undefined;
            });
            account.members.push(...newUidValues);
            const updatedAccount = await this.accountRepository.saveAccount(account);
            await this.addUsersToAllUsers(accountIdString, newUidValues.map(u => u.value()));
            await this.updateAccountTotalLicenses(accountIdString, updatedAccount.members);
            await this.updateAccountMemberships(accountIdString, account.members);
            const extendedAccounts = this.extendAccounts([updatedAccount]);
            captureServerEvent(ServerEvent.AccountMemberAddedMany,
                { accountId: accountIdString, userId: fromUserId },
                { userIds, usersCount: userIds.length },
            );
            return extendedAccounts;
        });
    }

    removeMember(
        accountId: string,
        userId: string,
        _manageMemberTrigger: ManageMemberTrigger,
        fromUserAgent?: string,
        fromUserId?: string,
        fromUserIp?: string | string[],
    ): Promise<ClientAccount> {
        return this.withAccountIdAndUserId(accountId, userId, async (accountIdObject, userIdObject) => {
            const account = await this.accountRepository.getAccount(accountIdObject);
            const userIdValue = userIdObject.value();
            account.members = account.members.filter(memberId => memberId.value() !== userIdValue);
            await this.removeAccountMember(accountId, userId, fromUserAgent, fromUserId, fromUserIp);
            const updatedAccount = await this.accountRepository.saveAccount(account);
            await this.updateAccountTotalLicenses(accountId, updatedAccount.members);
            await this.updateAccountMemberships(accountId, account.members);
            const [clientAccount] = await this.extendAccounts([updatedAccount]);
            return clientAccount;
        });
    }

    private async removeAccountMember(
        accountId: string,
        userId: string,
        fromUserAgent?: string,
        fromUserId?: string,
        fromUserIp?: string | string[],
    ): Promise<void> {
        await this.authorizationContract.removeUserFromAccount(
            accountId,
            userId,
            fromUserAgent,
            fromUserId,
            fromUserIp,
        );
        await this.userContract.removeUserFromAccountUsergroups(
            accountId,
            userId,
            fromUserAgent,
            fromUserId,
            fromUserIp,
        );
        try {
            await this.repoServiceClient.removeOwnerIdFromItemOwnershipForAccount(userId, accountId);
        } catch (e) {
            this.logger.error(`Failed to remove the groupId ${userId} from ownership on all items on ${accountId}`, "remove-member");
        }
        await this.notificationServiceClient.deleteNotificationTargets(
            userId,
            accountId
        );
        captureServerEvent(ServerEvent.AccountMemberRemoved, { accountId, userId: fromUserId }, { userId });
    }

    async removeMembers(
        accountId: string,
        userIds: string[],
        _manageMemberTrigger: ManageMemberTrigger,
        fromUserAgent?: string,
        fromUserId?: string,
        fromUserIp?: string | string[],
    ): Promise<ClientAccount> {

        for (const userId of userIds) {
            await this.removeAccountMember(accountId, userId, fromUserAgent, fromUserId, fromUserIp);
        }
        const accountIdObject = new AccountIdentifier(accountId);
        const account = await this.accountRepository.getAccount(accountIdObject);
        account.members = account.members.filter(
            m => !userIds.includes(m.value())
        );
        const updatedAccount = await this.accountRepository.saveAccount(account);
        await this.updateAccountTotalLicenses(accountId, updatedAccount.members);
        await this.updateAccountMemberships(accountId, account.members);
        const [clientAccount] = await this.extendAccounts([updatedAccount]);
        return clientAccount;
    }

    async linkFeature(accountId: string, feature: string, userId?: string): Promise<void> {
        const newFeature = { feature, enabled: true };
        await this.accountFeaturesRepository.updateAccountFeatures(accountId, [newFeature]);

        captureServerEvent(ServerEvent.EnableFeature, { accountId, userId }, { feature });
        this.captureEnabledFeatureFlags(accountId);
    }

    async unlinkFeature(accountId: string, feature: string, userId?: string): Promise<void> {
        const newFeature = { feature, enabled: false };
        await this.accountFeaturesRepository.updateAccountFeatures(accountId, [newFeature]);

        captureServerEvent(ServerEvent.DisableFeature, { accountId, userId }, { feature });
        this.captureEnabledFeatureFlags(accountId);
    }

    async captureEnabledFeatureFlags(accountId: string) {
        const enabledFeatures = await this.accountFeaturesRepository.getAccountFeatures(accountId);
        updatePosthogAccountProperties(accountId, { enabledFeatures });
    }

    async update(
        accountIdString: string,
        name: string,
        subscriptionType: string,
        expirationDate: string,
        readerExpirationDate: string,
        maxNumberOfLicenses: number,
        maxPublicCount: number,
        customerInfo: ICustomerInfo,
        htmlHeadContent?: string,
        userId?: string,
    ): Promise<ClientAccount> {
        return this.withAccountId(accountIdString, async accountId => {
            const account = await this.accountRepository.getAccount(accountId);
            account.name = name;
            account.subscriptionType = SubscriptionTypes.toEnumUnsafe(subscriptionType);
            account.expirationDate = new Date(expirationDate);
            account.readerExpirationDate = new Date(readerExpirationDate);

            const updatedAccount = await this.accountRepository.saveAccount(account);
            const [licensing] = await this.accountLicensingRepository.findLicensingForAccounts([accountIdString]);

            const updatedLicensing = await this.accountLicensingRepository.updateLicensing({
                ...licensing,
                maxNumberOfLicenses,
                maxPublicCount,
            });

            if (customerInfo && Object.keys(customerInfo).length) {
                await this.handleCreateAccordingCustomer(accountId.value(), customerInfo, userId);
            }

            if (htmlHeadContent !== undefined) {
                if (!isValidHtml(htmlHeadContent)) {
                    this.logger.error(`invalid html provided in update account: ${htmlHeadContent}`, "update");
                    return toClientAccount(account, licensing);
                }
                const settings = await this.accountSettingsRepository.getAccountSettings(accountIdString);
                const updatedSettings = (<AccountSettings>settings).setHtmlHeadContent(htmlHeadContent);
                await this.accountSettingsRepository.saveAccountSettings(accountIdString, updatedSettings.settings);
            }

            updatePosthogAccountProperties(accountIdString, {
                name: updatedAccount.name,
                membersCount: updatedAccount.members.length,
                totalLicenses: licensing?.totalLicenses,
                maxNumberOfLicenses: licensing?.maxNumberOfLicenses,
                totalPublicDocuments: licensing?.totalPublicDocuments,
                maxPublicCount: licensing?.maxPublicCount,
                createdAt: updatedAccount.created,
                expirationDate: updatedAccount.expirationDate,
                readerExpirationDate: updatedAccount.readerExpirationDate,
                domain: updatedAccount.domainFilters?.at(0)?.domain,
                rootCollectionId: updatedAccount.rootCollectionId
            });

            return toClientAccount(updatedAccount, updatedLicensing, htmlHeadContent);
        });
    }

    async getAccountIdsForUser(userId: string): Promise<string[]> {
        return await this.accountRepository.findAccountIdsForUser(userId);
    }

    async getAccountIdsForUsersAndGroups(ids: string[]): Promise<Record<string, string[]>> {
        const [usergroupIds, userIds] = partition(isUsergroupId, ids);
        const userAccountMap = userIds.length ?
            await this.accountRepository.findAccountIdsForUsers(userIds) :
            {};
        const usergroupAccountMap = usergroupIds.length ?
            await this.userContract.getAccountIdsForGroups(usergroupIds) :
            {};
        return {
            ...userAccountMap,
            ...Object.entries(usergroupAccountMap).reduce((acc, [groupId, accountId]) => ({
                ...acc,
                [groupId]: [accountId],
            }), {}),
        } as Record<string, string[]>;
    }

    async getAllFeaturesByAccount(): Promise<FeaturesByAccount> {
        return await this.accountFeaturesRepository.getAllFeaturesByAccount();
    }

    async getAccountsForUser(userId: string, getAccountOptions?: IGetAccountOptions): Promise<ClientAccount[]> {
        const checkForAdminPermission = getAccountOptions && getAccountOptions.checkForAdminPermission;
        const cdnnify = getAccountOptions && getAccountOptions.cdnnify;
        const accounts = await this.accountRepository.findAccountsForUser(userId);
        if (accounts.length === 0) {
            return [];
        }
        if (!checkForAdminPermission) {
            return this.extendAccounts(accounts);
        }
        const accountIds = accounts.map(acc => acc.id.value());
        const [rootCollections, domainFilters, myOwnedUsergroupsResult, featuresByAccount, accountsPermissionFlags, licenses] = await Promise.all([
            this.repoServiceClient.getRootCollections(accountIds),
            this.routingServiceClient.getDomainFiltersForAccounts(accountIds),
            this.userContract.searchUsergroups({ ownerId: userId }, { maxResults: 99999 }),
            this.accountFeaturesRepository.getAllFeaturesByAccount(),
            getAccountsPermissionFlags(accountIds, userId, this.authorizationContract),
            this.accountLicensingRepository.findLicensingForAccounts(accountIds),
        ]);

        const imageFormatTransformer = new ImageFormatsTransformer(this.imageServiceClient, this.jwtConfig, {
            thumbnailsOnly: true,
            cdnnify,
        });
        const transformedRootCollections = await imageFormatTransformer.items(rootCollections);

        const clientAccounts: ClientAccount[] = [];
        for (const serviceAccount of accounts) {
            const accountId = serviceAccount.id.value();

            const { amIAdmin, canIEdit } = accountsPermissionFlags[accountId];
            const features = featuresByAccount.find(entry => entry.accountId === accountId)?.features;
            const accountFeaturesGroupOwners = features?.includes(FEATURE_GROUP_OWNERS);
            const accountFeaturesCeva = features?.includes(FEATURE_CEVA);
            const doIOwnUsergroups = myOwnedUsergroupsResult.hits.some(ug => ug.accountId === accountId);

            const rootCollection = transformedRootCollections.find(c => c.accountId === accountId);
            const licensing = licenses.find(license => license.accountId === accountId);
            serviceAccount.domainFilters = domainFilters.filter(d => d.accountId === accountId);

            clientAccounts.push({
                ...toClientAccount(serviceAccount, licensing),
                amIAdmin,
                canIEdit,
                canIAccessUsergroupsMgmt: amIAdmin || (accountFeaturesGroupOwners && !accountFeaturesCeva && doIOwnUsergroups),
                canIAccessImportUsersMgmt: amIAdmin || (accountFeaturesGroupOwners && accountFeaturesCeva && doIOwnUsergroups),
                canIAccessAnalytics: amIAdmin || await this.shouldSupportContentAdminAnalytics(userId, accountId),
                accountIsNotExpired: this.isAccountNotExpired(serviceAccount),
                rootCollectionId: rootCollection ? rootCollection.id : undefined,
                thumbnail: rootCollection ? rootCollection.thumbnail : undefined,
            });
        }
        return clientAccounts;
    }

    private async shouldSupportContentAdminAnalytics(userId: string, accountId: string): Promise<boolean> {
        return await this.launchDarkly.getFlag(LDFlags.SUBCOLLECTION_ANALYTICS) &&
            await this.hasAdminPermissionsToAnyItem(userId, accountId);
    }

    private async hasAdminPermissionsToAnyItem(userId: string, accountId: string): Promise<boolean> {
        const resourceGroups = await this.authorizationContract.findAllowedResourceGroups(
            userId,
            ResourceType.DOCUMENT,
            PermissionName.ADMIN,
            true,
            accountId
        );
        // Ignore empty resource groups
        return resourceGroups.some(resourceGroup => resourceGroup.ids.length > 0);
    }

    mine(): Promise<ClientAccount[]> {
        return Promise.reject("not implemented. use getAccountsForUser");
    }

    async findAccountsForIds(accountIds: string[]): Promise<ClientAccount[]> {
        const accounts = await this.accountRepository.findAccountsForIds(accountIds);
        return this.extendAccounts(accounts);
    }

    async getAccountsForADTenant(tenantId: string): Promise<ClientAccount[]> {
        const accountIds = await this.accountSettingsRepository.findAccountIdsForADTenant(tenantId);
        if (accountIds.length === 0) {
            return [];
        }
        return this.findAccountsForIds(accountIds);
    }

    setAccountSubscription(accountIdString: string, subscriptionId: string): Promise<ClientAccount> {
        return this.withAccountId(accountIdString, async accountId => {
            const account = await this.accountRepository.getAccount(accountId);
            account.subscriptionId = subscriptionId;
            const savedAccount = await this.accountRepository.saveAccount(account);
            const [licensing] = await this.accountLicensingRepository.findLicensingForAccounts([accountIdString]);
            return toClientAccount(savedAccount, licensing);
        });
    }

    private async getAccountThumbnail(accountId: string): Promise<IThumbnail> {
        const features = await this.getAccountFeatures(accountId);
        if (!features.includes(FEATURE_BROWSER_LOGO_FAVICON)) return null;
        const cdnnify = !features.includes(FEATURE_NOCDN);
        const rootCollections = await this.repoServiceClient.getRootCollections([accountId]);
        if (rootCollections.length === 0) throw new Error(`No root collection found for account with id ${accountId}`);
        const imageFormatTransformer = new ImageFormatsTransformer(this.imageServiceClient, this.jwtConfig, {
            thumbnailsOnly: true,
            cdnnify,
        });
        const transformedRootCollections = await imageFormatTransformer.items(rootCollections);
        return transformedRootCollections[0].thumbnail;
    }

    async getAccountSettings(accountId: string, session?: AuthenticatedSession): Promise<IAccountSettings> {
        let isAdmin = session?.isBackend ?? false;
        if (!isAdmin && session?.userId) {
            isAdmin = await this.isAdminOfAccount(accountId, session.userId);
        }
        const [
            accountSettings,
            thumbnail
        ] = await Promise.all([
            this.accountSettingsRepository.getAccountSettings(accountId),
            this.getAccountThumbnail(accountId)
        ])
        return {
            ...accountSettings.settings,
            thumbnail,
            ...{ userTokenSecret: (isAdmin ? accountSettings.settings.userTokenSecret : undefined) }
        };
    }

    private async isAdminOfAccount(accountId: string, userId: string): Promise<boolean> {
        const accountsWithEditorPermissions = await this.authorizationContract.getAccountsForEditor(userId);
        return accountsWithEditorPermissions
            .filter(acc => acc.accountId === accountId)
            .filter(acc => acc.permissions.some(isAccountEditPermission))
            .length > 0;
    }

    async getPublicAccountSettings(accountId: string): Promise<IPublicAccountSettings> {
        const settings = await this.getAccountSettings(accountId);
        return {
            visuals: settings.visuals,
            languages: settings.languages,
            pdfExport: settings.pdfExport,
            thumbnail: settings.thumbnail,
        };
    }

    async setAccountDefaultVisualSettings(accountId: string, visualSettings: IVisualsAccountSettings): Promise<void> {
        const settings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const updatedSettings = settings.setDefaultVisualSettings(visualSettings);
        await this.accountSettingsRepository.saveAccountSettings(accountId, updatedSettings.settings);
        // Clear the cache used by the image service
        await this.flushingAccountClient.getAccountSettings(accountId);
    }

    async getAccountFeatures(accountId?: string): Promise<Array<string>> {
        return this.accountFeaturesRepository.getAccountFeatures(accountId);
    }

    async getAccountFeaturesUsage(): Promise<IFeatureUsage> {
        const featuresByAccount = await this.accountFeaturesRepository.getAllFeaturesByAccount();

        return featuresByAccount.reduce((result, account) => {
            account.features.forEach(feature => {
                if (result[feature] == null) {
                    result[feature] = [];
                }
                result[feature].push(account.accountId);
            })
            return result;
        }, {} as IFeatureUsage);
    }

    async setAccountFeatures(accountId: string, features: string[], options?: IUpdateFeaturesOptions): Promise<void> {
        await this.accountFeaturesRepository.updateAccountFeatures(
            accountId,
            features.map(feature => ({ feature, enabled: true })),
            options
        );
    }

    async setAccountDefaultLanguageSettings(accountId: string, languageSettings: ILanguageAccountSettings): Promise<void> {
        const settings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const currentLanguageSettings = settings.getDefaultLanguageSettings();
        const updatedLanguageSettings = { ...currentLanguageSettings, ...languageSettings };
        const updatedSettings = settings.setLanguageSettings(updatedLanguageSettings);

        await this.accountSettingsRepository.saveAccountSettings(accountId, updatedSettings.settings);
    }

    async setAccountDefaultInterfaceLanguage(accountId: string, languageSettings: ILanguageAccountSettings): Promise<void> {
        const settings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const currentLanguageSettings = settings.getDefaultLanguageSettings();
        const updatedLanguageSettings = { ...currentLanguageSettings, ...languageSettings };
        const updatedSettings = settings.setLanguageSettings(updatedLanguageSettings);

        await this.accountSettingsRepository.saveAccountSettings(accountId, updatedSettings.settings);
    }

    async setAccountSortMethod(accountId: string, sortMethod: AccountSortMethod): Promise<void> {
        const settings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const currentSortSettings = settings.getSortSettings();
        const updatedSortSettings = { ...currentSortSettings, sortMethod };
        const updatedSettings = settings.setSortSettings(updatedSortSettings);
        await this.accountSettingsRepository.saveAccountSettings(accountId, updatedSettings.settings);
    }

    async setAccountDefaultPDFExportSettings(accountId: string, settings: IPDFExportAccountSettings): Promise<void> {
        const accountSettings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const savedSettings = accountSettings.getPDFExportSettings();
        const pdfSettings = { ...savedSettings, ...settings };
        const updatedSettings = accountSettings.setPDFExportSettings(pdfSettings);
        await this.accountSettingsRepository.saveAccountSettings(
            accountId,
            updatedSettings.settings,
        );
    }

    async setAccountMTSettings(accountId: string, settings: IMTAccountSettings): Promise<void> {
        const accountSettings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const savedSettings = accountSettings.getMTSettings();
        const mtSettings = { ...savedSettings, ...settings };
        const updatedSettings = accountSettings.setMTSettings(mtSettings);
        await this.accountSettingsRepository.saveAccountSettings(
            accountId,
            updatedSettings.settings,
        );
    }

    async setAccountSecuritySettings(accountId: string, settings: SecuritySettings): Promise<void> {
        const accountSettings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const savedSettings = accountSettings.getSecuritySettings();
        const securitySettings = { ...savedSettings, ...settings };
        const updatedSettings = accountSettings.setSecuritySettings(securitySettings);
        await this.accountSettingsRepository.saveAccountSettings(
            accountId,
            updatedSettings.settings,
        );
    }

    async setAccountAG5Settings(accountId: string, settings: AG5Settings): Promise<void> {
        const accountSettings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const savedSettings = accountSettings.getAG5Settings();
        const ag5Settings = { ...savedSettings, ...settings };
        const updatedSettings = accountSettings.setAG5Settings(ag5Settings);
        await this.accountSettingsRepository.saveAccountSettings(
            accountId,
            updatedSettings.settings,
        );
    }

    async setAccountMTSettingsLanguagePair(
        accountId: string,
        languageCodesSerialized: string,
        engineType: MTEngineType | null,
        replacesLanguageCodesSerialized?: string,
    ): Promise<IMTAccountSettings> {
        const accountSettings = await this.accountSettingsRepository.getAccountSettings(accountId);
        let updatedSettings = accountSettings.setMTLanguagePair(languageCodesSerialized, engineType);
        if (replacesLanguageCodesSerialized) {
            updatedSettings = accountSettings.setMTLanguagePair(replacesLanguageCodesSerialized, null);
        }
        await this.accountSettingsRepository.saveAccountSettings(
            accountId,
            updatedSettings.settings,
        );
        return accountSettings.getMTSettings();
    }

    async setSSOSettings(accountId: string, ssoSettings: ISAMLSSOSettings): Promise<void> {
        const settings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const updatedSettings = (<AccountSettings>settings).setSSOSettings(ssoSettings);
        await this.accountSettingsRepository.saveAccountSettings(accountId, updatedSettings.settings);
    }
    async getSSOSettings(accountId: string): Promise<ISAMLSSOSettings> {
        const settings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const samlSettings = (<AccountSettings>settings).getSSOSettings();
        return samlSettings;
    }

    async updateTotalPublicDocumentLicensing(accountId: string): Promise<void> {
        const [licensing] = await this.accountLicensingRepository.findLicensingForAccounts([accountId]);
        const totalPublicDocuments = await this.repoServiceClient.countAllPublicDocuments(accountId);
        await this.accountLicensingRepository.updateLicensing({
            ...licensing,
            totalPublicDocuments,
        })
    }

    async findExceedingLimitsLicensing(): Promise<AccountLicensing[]> {
        return this.accountLicensingRepository.findExceedingLimitsLicensing();
    }

    async getAccountLicensing(accountId: string): Promise<AccountLicensing> {
        const [licensing] = await this.accountLicensingRepository.findLicensingForAccounts([accountId]);
        return licensing;
    }

    async getHelpAccount(getAccountOptions?: IGetAccountOptions): Promise<ClientAccount> {
        if (this.helpAccount !== undefined) {
            return this.helpAccount;
        }

        // I think the best would be to have a field isHelpAccount and fetch it like that
        const cdnnify = getAccountOptions && getAccountOptions.cdnnify;
        const helpAccountId = "aid-d38e6061-4539-488d-8bf3-204c3968f4ff";
        const [account] = await this.accountRepository.findAccountsForIds([helpAccountId]);
        if (account) {
            const [rootCollection] = await this.repoServiceClient.getRootCollections([helpAccountId]);
            const imageFormatTransformer = new ImageFormatsTransformer(
                this.imageServiceClient,
                this.jwtConfig,
                {
                    thumbnailsOnly: true,
                    cdnnify,
                },
            );
            const [transformedRootCollection] = await imageFormatTransformer.items([rootCollection]);
            const [domain] = await this.routingServiceClient.getDomainFiltersForAccounts([helpAccountId]);
            account.domainFilters.push(domain);

            const [licensing] = await this.accountLicensingRepository.findLicensingForAccounts([
                helpAccountId,
            ]);

            this.helpAccount = {
                ...toClientAccount(account, licensing),
                thumbnail: transformedRootCollection ? transformedRootCollection.thumbnail : undefined,
            };
        } else {
            this.helpAccount = {
                id: "aid-help",
                name: "help.manual.to",
                members: [],
                subscriptionType: "standard",
                subscriptionId: "",
                expirationDate: "9999-12-31",
                accountIsNotExpired: true,
                domains: ["help.manual.to"],
                created: new Date(),
            }
        }
        return this.helpAccount;
    }

    async generateUserTokenSecretForAccountId(accountId: string): Promise<string> {
        const hasNeededFeature = await this.hasAccountFeature(accountId, FEATURE_USERTOKEN_LOGIN);
        if (!hasNeededFeature) {
            throw new Unauthorized("You don't have the required permission.");
        }

        const targetSecretBytesLength = 64;
        const randomBytesGenerated = (targetSecretBytesLength * 3) / 4;
        const secret = crypto.randomBytes(randomBytesGenerated).toString("base64");

        const settings = await this.accountSettingsRepository.getAccountSettings(accountId);
        const updatedSettings = (<AccountSettings>settings).setUserTokenSecret(secret);
        await this.accountSettingsRepository.saveAccountSettings(accountId, updatedSettings.settings);

        return secret;
    }

    async findAccountMemberships(accountId: string): Promise<IAccountMembership[]> {
        return this.accountMembershipRepository.findForAccount(accountId);
    }

    async updateStorageDetails(accountId: string, storageDetails: IAccountStorageDetails): Promise<ClientAccount> {
        return this.withAccountId(accountId, async accountIdentifier => {
            const account = await this.accountRepository.getAccount(accountIdentifier)
            account.storageDetails = { ...account.storageDetails, ...storageDetails }
            const savedAccount = await this.accountRepository.saveAccount(account)
            const [clientAccount] = await this.extendAccounts([savedAccount]);
            return clientAccount;
        })
    }

    private async hasAccountFeature(accountId: string, feature: string): Promise<boolean> {
        const accountFeatures = await this.getAccountFeatures(accountId);
        return accountFeatures.indexOf(feature) > -1;
    }

    async createMSTransactableSetupRequest(params: CreateMSAccountSetupRequestParams): Promise<void> {
        const existingRequest = await this.msAccountSetupRequestsRepository.getAccountSetupRequestByToken(params.purchaseIdToken);
        if (existingRequest != null) {
            throw new MSPurchaseIdTokenAlreadyKnown(params.purchaseIdToken);
        }

        const purchase = await this.msTransactableOffersApi.resolvePurchaseIdToken(params.purchaseIdToken);

        const subscription = await this.nullIfNotFound(() =>
            this.msTransactableSubscriptionsRepository.getTransactableSubscription(
                purchase.subscription.id
            )
        );
        if (subscription != null) {
            throw new MSTokenBelongsToActiveAccount(params.purchaseIdToken);
        }

        const setupRequest = new MSAccountSetupRequest(
            params.purchaseIdToken,
            purchase.id,
            purchase.subscription.id,
            purchase.offerId,
            purchase.planId,
            purchase.subscription?.purchaser?.tenantId,
            purchase.quantity,
            params.firstName,
            params.lastName,
            params.phone,
            params.companyName,
            params.companySite,
            params.email
        );
        await this.msAccountSetupRequestsRepository.createAccountSetupRequest(setupRequest);

        const event = transactableEventFromSetupRequest(setupRequest);
        await this.msTransactableEventsRepository.createEvent(event);

        // Notify client
        this.mailer.sendMSTransactable(f => f.createMSClientWelcomeEmail(setupRequest));
        // Notify us
        this.mailer.sendMSTransactable(f => f.createMSAccountSetupRequestEmail(setupRequest));
    }

    async listMSTransactableSetupRequests(): Promise<IMSAccountSetupRequest[]> {
        return await this
            .msAccountSetupRequestsRepository
            .listAccountSetupRequests();
    }

    async msTransactableOffersFullfillmentWebhook(
        data: MSTransactableOffersFullfillmentWebhookData
    ): Promise<void> {
        const operation = await this.msTransactableOffersApi.getOperationById(
            data.id,
            data.subscriptionId
        );

        const event = transactableEventFromOperation(operation)
        await this.msTransactableEventsRepository.createEvent(event);

        const subscription = await this.msTransactableSubscriptionsRepository.getTransactableSubscription(
            operation.subscriptionId
        );
        if (subscription == null) {
            throw new MSSubscriptionIdNotLinkedToAccount(operation.subscriptionId);
        }

        const account: Account = await this.accountRepository.getAccount(
            new AccountIdentifier(subscription.accountId)
        );
        if (account == null) {
            throw new AccountNotFound(subscription.accountId);
        }

        if (operation.action === "Suspend") {
            this.mailer.sendMSTransactable(f => f.createMSSuspendedEmail(account));
        } else if (operation.action === "Unsubscribe") {
            const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));
            account.expirationDate = yesterday;
            account.accountIsNotExpired = false;
            await this.accountRepository.saveAccount(account);
            this.mailer.sendMSTransactable(f => f.createMSUnsubscribedEmail(account));
        } else if (operation.action === "ChangePlan") {
            this.mailer.sendMSTransactable(f => f.createMSChangePlanEmail(account, operation));
        } else if (operation.action === "ChangeQuantity") {
            const [licensing] = await this.accountLicensingRepository.findLicensingForAccounts(
                [account.id.value.toString()]
            );
            await this.accountLicensingRepository.updateLicensing({
                ...licensing,
                maxNumberOfLicenses: operation.quantity,
            });
            this.mailer.sendMSTransactable(f => f.createMSChangePlanEmail(account, operation));
        } else if (operation.action === "Reinstate") {
            this.mailer.sendMSTransactable(f => f.createMSReinstateEmail(account));
        }
    }

    async resolveMSPurchaseIdToken(
        purchaseIdToken: string
    ): Promise<ResolveMSPurchaseIdTokenResponse> {
        const purchase = await this.msTransactableOffersApi.resolvePurchaseIdToken(
            purchaseIdToken
        );

        const mappedAccount = await this.nullIfNotFound(async () => {
            const subscription = await this.msTransactableSubscriptionsRepository
                .getTransactableSubscription(purchase.subscription.id);

            if (subscription == null) {
                throw new MSTransactableSubscriptionNotFound(purchase.subscription.id);
            }

            const account = await this.accountRepository.getAccount(
                new AccountIdentifier(subscription.accountId)
            );

            const routeMapping = await this.routingServiceClient.getDomainFiltersForAccounts(
                [subscription.accountId]
            );
            const domain = routeMapping[0].domain;

            return {
                id: account.id.value().toString(),
                name: account.name,
                expirationDate: account.expirationDate.toISOString(),
                memberCount: account.members.length,
                domain
            }
        });

        const setupRequest = await this.msAccountSetupRequestsRepository
            .getAccountSetupRequestBySubscription(purchase.subscription.id);

        return {
            account: mappedAccount,
            setupRequest,
            purchase: {
                id: purchase.id,
                purchaseIdToken,
                subscriptionId: purchase.subscription.id,
                subscriptionName: purchase.subscriptionName,
                quantity: purchase.quantity,
                purchaserEmail: purchase.subscription.purchaser.emailId
            }
        }
    }

    async getAccountSubscriptionByAccountId(
        accountId: string
    ): Promise<IMSTransactableSubscription> {
        return await this
            .msTransactableSubscriptionsRepository
            .getTransactableSubscriptionByAccountId(accountId);
    }

    async createMSTransactableSubscription(
        createParams: IMSTransactableSubscription
    ): Promise<void> {
        const setupRequest = await this
            .msAccountSetupRequestsRepository
            .getAccountSetupRequestBySubscription(createParams.subscriptionId);

        if (setupRequest == null) {
            throw new MSSetupRequestNotFound(createParams.subscriptionId);
        }

        const existingSubscription = await this
            .msTransactableSubscriptionsRepository
            .getTransactableSubscription(createParams.subscriptionId);

        if (existingSubscription != null) {
            throw new MSSubscriptionAlreadyExists(createParams.subscriptionId);
        }

        const accountIdentifier = new AccountIdentifier(createParams.accountId);
        await this.accountRepository.getAccount(accountIdentifier);

        const subscription = new MSTransactableSubscription(
            createParams.accountId,
            createParams.subscriptionId
        );

        await this.msTransactableSubscriptionsRepository
            .createTransactableSubscription(subscription);

        await this.msAccountSetupRequestsRepository
            .deleteAccountSetupRequest(createParams.subscriptionId);

        await this.activateMicrosoftSubscription(
            createParams.subscriptionId,
            setupRequest.quantity
        );
    }

    private async activateMicrosoftSubscription(
        subscriptionId: string,
        quantity: number
    ): Promise<void> {
        try {
            const subscription = await this.msTransactableOffersApi.getSubscription(subscriptionId);
            if (subscription == null) {
                this.mailer.sendMSTransactable(factory => (
                    factory.createGenericErrorEmail(
                        "Something went wrong while trying to activate a Microsoft subscription",
                        `Couldn't find the subscription with id "${subscriptionId}"`
                    )
                ));
            }

            if (subscription.saasSubscriptionStatus.trim() !== "PendingFulfillmentStart") return;

            await this.msTransactableOffersApi.activateSubscription(
                subscription.id,
                subscription.planId,
                quantity
            );
        } catch (e) {
            this.mailer.sendMSTransactable(factory => (
                factory.createGenericErrorEmail(
                    "Something went wrong while trying to activate a Microsoft subscription",
                    `We couldn't automatically activate the subscription with id "${subscriptionId}"`,
                    e.message
                )
            ));
        }
    }

    private async nullIfNotFound<T>(action: () => Promise<T>): Promise<null | T> {
        try {
            return await action();
        } catch (e) {
            if (e.name === EntityNotFound.name) {
                return null;
            }
            throw e;
        }
    }

    async listCustomers(): Promise<ICustomer[]> {
        const customers = await this.customerRepository.listCustomers();
        return customers.map(c => toClientCustomer(c));
    }

    async findCustomers(query: ICustomersQuery): Promise<ICustomer[]> {
        const customers = await this.customerRepository.findCustomers(query);
        return customers.map(c => toClientCustomer(c));
    }

    async createCustomer(
        name: string,
        crmCustomerId: string,
        doCreateAccount: boolean,
        userId: string,
    ): Promise<ICustomer> {
        const newCustomer = Customer.create(name, crmCustomerId);
        const customer = await this.customerRepository.saveCustomer(newCustomer);
        const twoWeeksFromNowISOString = addWeeks(Date.now(), 2).toISOString();
        if (doCreateAccount) {
            await this.createAccount(
                name,
                "standard",
                twoWeeksFromNowISOString,
                twoWeeksFromNowISOString,
                1000,
                1000,
                { customerId: customer.id.value() },
                userId,
                undefined,
            );
        }
        return toClientCustomer(customer);
    }

    async updateCustomer(customerIdString: string, name: string, crmCustomerId: string): Promise<ICustomer> {
        return this.withCustomerId(customerIdString, async customerId => {
            const customer = await this.customerRepository.getCustomer(customerId);
            customer.name = name;
            customer.crmCustomerId = crmCustomerId;
            const updatedCustomer = await this.customerRepository.saveCustomer(customer);
            return toClientCustomer(updatedCustomer);
        });
    }


    async deleteCustomer(customerIdString: string): Promise<void> {
        return this.withCustomerId(customerIdString, async customerId => {
            await this.customerRepository.deleteCustomer(customerId);
        });
    }

    removeAccountFromCustomer(
        customerId: string,
        accountId: string,
    ): Promise<ICustomer> {
        return this.withCustomerIdAndAccountId(customerId, accountId, async (customerIdObject, accountIdObject) => {
            const customer = await this.customerRepository.getCustomer(customerIdObject);
            customer.accountIds = customer.accountIds.filter(accountId => accountId.value() !== accountIdObject.value());
            const updatedCustomer = await this.customerRepository.saveCustomer(customer);
            return toClientCustomer(updatedCustomer);
        });
    }

    async deleteAccountFromAllCustomers(accountId: string): Promise<void> {
        const customers = await this.customerRepository.findCustomers({ accountId });
        for await (const customer of customers) {
            customer.accountIds = customer.accountIds.filter(aid => aid.value() !== accountId);
            await this.customerRepository.saveCustomer(customer);
        }
    }

    async addAccountToCustomer(
        customerId: string,
        accountId: string,
    ): Promise<ICustomer> {
        return this.withCustomerIdAndAccountId(customerId, accountId, async (customerIdObject, accountIdObject) => {
            const customer = await this.customerRepository.getCustomer(customerIdObject);
            customer.accountIds = customer.accountIds.filter(accountId => accountId.value() !== accountIdObject.value());
            customer.accountIds.push(accountIdObject);
            const savedCustomer = await this.customerRepository.saveCustomer(customer);
            return toClientCustomer(savedCustomer);
        });
    }

    async setAnonymised(accountId: string, isAnonymised: boolean): Promise<ClientAccount> {
        return this.withAccountId(accountId, async (aid) => {
            const account = await this.accountRepository.getAccount(aid)
            account.isAnonymised = isAnonymised;
            await this.accountRepository.saveAccount(account);
            return (await this.extendAccounts([account]))[0];
        })
    }

    async bootstrapTrialEnvironment(props: BootstrapTrialEnvironmentProps): Promise<void> {
        await bootstrapTrialEnvironment({
            accountServiceClient: this,
            repoServiceClient: this.repoServiceClient,
            authorizationServiceClient: this.authorizationContract,
            routingServiceClient: this.routingServiceClient,
            userServiceClient: this.userContract,
        }, props);
    }

    async getAccountsByFeatures(features: IFeature[]): Promise<ClientAccount[]> {
        const accountIds = await this.accountFeaturesRepository.getAccountIdsByFeatures(features);
        const accounts = await this.accountRepository.findAccountsForIds(accountIds);
        return this.extendAccounts(accounts);
    }

    async getLaunchDarklyFlagsForFrontend(accountId: string, userId?: string): Promise<Record<LDFlags, unknown>> {
        return (await this.launchDarkly.getAllFlags({ accountId, userId }) as Record<LDFlags, unknown>);
    }
}

export class AccountServiceFactory {
    private accountRepositoryFactory: MongoAccountRepositoryFactory;
    private customerRepositoryFactory: MongoCustomerRepositoryFactory;
    private accountSettingsRepositoryFactory: MongoAccountSettingsRepositoryFactory;
    private accountFeaturesRepositoryFactory: MongoAccountFeaturesRepositoryFactory;
    private accountLicensingRepositoryFactory: MongoLicensingRepositoryFactory;
    private accountMembershipRepositoryFactory: MongoAccountMembershipRepositoryFactory;
    private msAccountSetupRequestsRepositoryFactory: MongoMSAccountSetupRequestsRepositoryFactory;
    private msTransactableEventsRepositoryFactory: MongoMSTransactableEventsRepositoryFactory;
    private msTransactableSubscriptionsRepositoryFactory: MongoMSTransactableSubscriptionsRepositoryFactory;
    private readonly msTransactableOffersApi: IMSTransactableOffersApi;
    private readonly redisClient: RedisClient;
    private readonly jwtConfig: JWTSignConfig;

    constructor(
        private readonly config: Config,
        private readonly authorizationServiceBuilder: (logger?: Logger) => AuthorizationServiceClient,
        private readonly userService: UserServiceClient,
        private readonly credentialService: CredentialServiceContract,
        private readonly repositoryService: BindersRepositoryServiceContract,
        private readonly routingService: RoutingServiceContract,
        private readonly imageService: ImageServiceContract,
        accountCollectionConfig: CollectionConfig,
        customerCollectionConfig: CollectionConfig,
        accountSettingsCollectionConfig: CollectionConfig,
        accountFeaturesCollectionConfig: CollectionConfig,
        accountLicensingCollectionConfig: CollectionConfig,
        accountMembershipCollectionConfig: CollectionConfig,
        msAccountSetupRequestsCollectionConfig: CollectionConfig,
        msTransactableEventsCollectionConfig: CollectionConfig,
        msTransactableSubscriptionsCollectionConfig: CollectionConfig,
        private readonly backendClient: AccountServiceClient,
        private readonly notificationClient: NotificationServiceClient,
        private readonly mailer: AccountServiceMailer,
        private readonly launchDarkly: LaunchDarklyService,
    ) {
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        this.accountRepositoryFactory = new MongoAccountRepositoryFactory(accountCollectionConfig, topLevelLogger);
        this.customerRepositoryFactory = new MongoCustomerRepositoryFactory(customerCollectionConfig, topLevelLogger);
        this.accountSettingsRepositoryFactory = new MongoAccountSettingsRepositoryFactory(
            accountSettingsCollectionConfig,
            topLevelLogger,
        );
        this.accountFeaturesRepositoryFactory = new MongoAccountFeaturesRepositoryFactory(
            accountFeaturesCollectionConfig,
            topLevelLogger,
        );
        this.accountLicensingRepositoryFactory = new MongoLicensingRepositoryFactory(
            accountLicensingCollectionConfig,
            topLevelLogger,
        );
        this.accountMembershipRepositoryFactory = new MongoAccountMembershipRepositoryFactory(
            accountMembershipCollectionConfig,
            topLevelLogger,
        );
        this.msAccountSetupRequestsRepositoryFactory = new MongoMSAccountSetupRequestsRepositoryFactory(
            msAccountSetupRequestsCollectionConfig,
            topLevelLogger
        );
        this.msTransactableEventsRepositoryFactory = new MongoMSTransactableEventsRepositoryFactory(
            msTransactableEventsCollectionConfig,
            topLevelLogger
        );
        this.msTransactableSubscriptionsRepositoryFactory = new MongoMSTransactableSubscriptionsRepositoryFactory(
            msTransactableSubscriptionsCollectionConfig,
            topLevelLogger
        );
        this.msTransactableOffersApi = MSTransactableOffersApiFactory.createFromConfig(config);
        this.jwtConfig = buildSignConfig(config);
        const { databaseName } = ACCOUNT_SERVICE_CACHE_OPTIONS;
        this.redisClient = RedisClientBuilder.fromConfig(config, databaseName);
    }

    forRequest(request: WebRequest): AccountService {
        const accountRepository = this.accountRepositoryFactory.build(request.logger);
        const customerRepository = this.customerRepositoryFactory.build(request.logger);
        const accountSettingsRepository = this.accountSettingsRepositoryFactory.build(request.logger);
        const accountFeaturesRepository = this.accountFeaturesRepositoryFactory.build(request.logger);
        const accounLicensingRepository = this.accountLicensingRepositoryFactory.build(request.logger);
        const accountMembershipRepository = this.accountMembershipRepositoryFactory.build(request.logger);
        const msAccountSetupRequestsRepository = this.msAccountSetupRequestsRepositoryFactory.build(request.logger);
        const msTransactableEventsRepository = this.msTransactableEventsRepositoryFactory.build(request.logger);
        const msTransactableSubscriptionsRepository = this.msTransactableSubscriptionsRepositoryFactory.build(request.logger);

        const flushingAccountClient = RedisCacheBuilder.getFlushingProxy(
            this.redisClient, ACCOUNT_SERVICE_CACHE_OPTIONS.options,
            this.backendClient, request.logger
        )
        return new AccountService(
            accountRepository,
            customerRepository,
            accountSettingsRepository,
            accountFeaturesRepository,
            accounLicensingRepository,
            accountMembershipRepository,
            msAccountSetupRequestsRepository,
            msTransactableEventsRepository,
            msTransactableSubscriptionsRepository,
            this.msTransactableOffersApi,
            this.authorizationServiceBuilder(request.logger),
            this.userService,
            this.credentialService,
            this.repositoryService,
            this.routingService,
            this.imageService,
            this.notificationClient,
            this.jwtConfig,
            flushingAccountClient,
            request.logger,
            this.mailer,
            this.launchDarkly,
        );
    }

    static fromConfig(config: Config): Promise<AccountServiceFactory> {
        const loginOption = getMongoLogin("account_service");
        return Promise.all([
            CollectionConfig.promiseFromConfig(config, "accounts", loginOption),
            CollectionConfig.promiseFromConfig(config, "mtCustomers", loginOption),
            CollectionConfig.promiseFromConfig(config, "accountSettings", loginOption),
            CollectionConfig.promiseFromConfig(config, "accountFeatures", loginOption),
            CollectionConfig.promiseFromConfig(config, "licensing", loginOption),
            CollectionConfig.promiseFromConfig(config, "accountMemberships", loginOption),
            CollectionConfig.promiseFromConfig(config, "msAccountSetupRequests", loginOption),
            CollectionConfig.promiseFromConfig(config, "msTransactableEvents", loginOption),
            CollectionConfig.promiseFromConfig(config, "msTransactableSubscriptions", loginOption),
            // CollectionConfig.promiseFromConfig(config, "ms")
            BackendAuthorizationServiceClient.createBuilderFromConfig(config, "accounts"),
            BackendRepoServiceClient.fromConfig(config, "accounts"),
            BackendRoutingServiceClient.fromConfig(config, "routing"),
            BackendUserServiceClient.fromConfig(config, "accounts"),
            BackendCredentialServiceClient.fromConfig(config, "accounts"),
            BackendImageServiceClient.fromConfig(config, "accounts"),
            BackendAccountServiceClient.fromConfig(config, "account-service"),
            BackendNotificationServiceClient.fromConfig(config, "account-service", null),
            AccountServiceMailer.fromConfig(config),
            getOrCreateLaunchDarklyService(config),
        ]).then(([
            accountsCollectionConfig,
            customerCollectionConfig,
            accountSettingsCollectionConfig,
            accountFeaturesCollectionConfig,
            accounLicensingCollectionConfig,
            accounMembershipsCollectionConfig,
            msAccountSetupRequestsCollectionConfig,
            msTransactableEventsCollectionConfig,
            msTransactableSubscriptionsCollectionConfig,
            azClientBuilder,
            repoClient,
            routingClient,
            userClient,
            credentialClient,
            imageClient,
            backendClient,
            notificationClient,
            mailer,
            launchDarkly,
        ]) => {
            return new AccountServiceFactory(
                config,
                azClientBuilder,
                userClient,
                credentialClient,
                repoClient,
                routingClient,
                imageClient,
                accountsCollectionConfig,
                customerCollectionConfig,
                accountSettingsCollectionConfig,
                accountFeaturesCollectionConfig,
                accounLicensingCollectionConfig,
                accounMembershipsCollectionConfig,
                msAccountSetupRequestsCollectionConfig,
                msTransactableEventsCollectionConfig,
                msTransactableSubscriptionsCollectionConfig,
                backendClient,
                notificationClient,
                mailer,
                launchDarkly,
            );
        });
    }
}

const isAccountEditPermission = (perm: AccountPermission): boolean =>
    perm.resourceType === ResourceType.ACCOUNT && perm.permission === PermissionName.EDIT;
