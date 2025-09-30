import {
    AG5Settings,
    Account,
    AccountLicensing,
    AccountServiceContract,
    AccountSortMethod,
    BootstrapTrialEnvironmentProps,
    CreateMSAccountSetupRequestParams,
    FeaturesByAccount,
    IAccountFilter,
    IAccountMembership,
    IAccountSettings,
    IAccountStorageDetails,
    ICustomer,
    ICustomerInfo,
    ICustomersQuery,
    IFeature,
    IFeatureUsage,
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
    ManageMemberTrigger,
    ResolveMSPurchaseIdTokenResponse,
    SecuritySettings
} from "./contract";
import { BindersServiceClient, RequestHandler } from "../../client";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config/config";
import { LDFlags } from "binders-client-v1/src/launchdarkly";
import { MTEngineType } from "../../repositoryservice/v3/contract";
import Thumbnail from "../../repositoryservice/v3/Thumbnail";
import getRoutes from "./routes";

export class AccountServiceClient extends BindersServiceClient implements AccountServiceContract {

    constructor(endpointPrefix: string, requestHandler: RequestHandler, accountIdProvider?: () => string) {
        super(endpointPrefix, getRoutes(), requestHandler, accountIdProvider);
    }

    static fromConfig(config: Config, version: string, requestHandler: RequestHandler, accountIdProvider?: () => string): AccountServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "account", version);
        return new AccountServiceClient(versionedPath, requestHandler, accountIdProvider);
    }

    listAccounts(includeHtmlHeadContent = false): Promise<Array<Account>> {
        return this.handleRequest("listAccounts", {
            queryParams: {
                ...(includeHtmlHeadContent ? { includeHtmlHeadContent: "1" } : {}),
            }
        });
    }

    listCustomers(): Promise<ICustomer[]> {
        return this.handleRequest("listCustomers", {});
    }

    findCustomers(query: ICustomersQuery): Promise<ICustomer[]> {
        const options = {
            body: {
                query: JSON.stringify(query),
            }
        };
        return this.handleRequest("findCustomers", options);
    }

    createCustomer(
        name: string,
        crmCustomerId: string,
        doCreateAccount: boolean,
    ): Promise<ICustomer> {
        const options = {
            body: {
                name,
                crmCustomerId,
                doCreateAccount,
            }
        };
        return this.handleRequest("createCustomer", options);
    }

    updateCustomer(
        customerId: string,
        name: string,
        crmCustomerId: string,
    ): Promise<ICustomer> {
        const options = {
            pathParams: {
                customerId
            },
            body: {
                name,
                crmCustomerId,
            }
        };
        return this.handleRequest("updateCustomer", options);
    }


    deleteCustomer(
        customerId: string,
    ): Promise<void> {
        const options = {
            pathParams: {
                customerId
            }
        };
        return this.handleRequest("deleteCustomer", options);
    }

    removeAccountFromCustomer(customerId: string, accountId: string): Promise<ICustomer> {
        const options = {
            pathParams: {
                customerId
            },
            body: {
                accountId,
            }
        };
        return this.handleRequest("removeAccountFromCustomer", options);
    }

    addAccountToCustomer(customerId: string, accountId: string): Promise<ICustomer> {
        const options = {
            pathParams: {
                customerId
            },
            body: {
                accountId,
            }
        };
        return this.handleRequest("addAccountToCustomer", options);
    }

    findAccounts(filter: IAccountFilter): Promise<Array<Account>> {
        const options = {
            body: {
                filter
            }
        };
        return this.handleRequest("findAccounts", options);
    }

    createAccount(
        name: string,
        subscriptionType: string,
        expirationDate: string,
        readerExpirationDate: string,
        maxNumberOfLicenses?: number,
        maxPublicCount?: number,
        customerInfo?: ICustomerInfo,
        id?: string,
        features?: string[],
        htmlHeadContent?: string,
    ): Promise<Account> {
        const options = {
            body: {
                id,
                name,
                subscriptionType,
                expirationDate,
                readerExpirationDate,
                maxNumberOfLicenses,
                maxPublicCount,
                customerInfo,
                features,
                htmlHeadContent,
            },
        };
        return this.handleRequest("createAccount", options);
    }

    deleteAccount(accountId: string): Promise<void> {
        return this.handleRequest("deleteAccount", {
            pathParams: {
                accountId
            }
        });
    }

    getAccount(accountId: string): Promise<Account> {
        const options = {
            pathParams: {
                accountId
            }
        };
        return this.handleRequest("getAccount", options);
    }

    generateUserTokenSecretForAccountId(accountId: string): Promise<string> {
        const options = {
            body: {
                accountId
            }
        };
        return this.handleRequest("generateUserTokenSecretForAccountId", options);
    }

    addMember(
        accountId: string,
        userId: string,
        manageMemberTrigger: ManageMemberTrigger,
        skipDefaultPermissions?: boolean,
        fromUserId?: string,
        fromUserIp?: string | string[],
        fromUserAgent?: string,
    ): Promise<Account> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                userId,
                manageMemberTrigger,
                fromUserAgent,
                fromUserId,
                fromUserIp,
                skipDefaultPermissions,
            }
        };
        return this.handleRequest("addMember", options);
    }

    addMembers(
        accountId: string,
        userIds: Array<string>,
        manageMemberTrigger: ManageMemberTrigger,
        fromUserId?: string,
        fromUserIp?: string | string[],
        fromUserAgent?: string,
    ): Promise<Array<Account>> {
        const options = {
            pathParams: {
                accountId,
            },
            body: {
                userIds,
                manageMemberTrigger,
                fromUserAgent,
                fromUserId,
                fromUserIp,
            }
        };
        return this.handleRequest("addMembers", options);
    }

    removeMember(accountId: string, userId: string, manageMemberTrigger: ManageMemberTrigger): Promise<Account> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                userId,
                manageMemberTrigger,
            }
        };
        return this.handleRequest("removeMember", options);
    }

    removeMembers(accountId: string, userIds: string[], manageMemberTrigger: ManageMemberTrigger): Promise<Account> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                userIds,
                manageMemberTrigger,
            }
        };
        return this.handleRequest("removeMembers", options);
    }

    linkFeature(accountId: string, feature: string): Promise<void> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                feature,
            }
        };
        return this.handleRequest<void>("linkFeature", options);
    }

    unlinkFeature(accountId: string, feature: string): Promise<void> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                feature
            }
        };
        return this.handleRequest<void>("unlinkFeature", options);
    }

    update(
        accountId: string,
        name: string,
        subscriptionType: string,
        expirationDate: string,
        readerExpirationDate: string,
        maxNumberOfLicenses?: number,
        maxPublicCount?: number,
        customerInfo?: ICustomerInfo,
        htmlHeadContent?: string,
    ): Promise<Account> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                name,
                subscriptionType,
                expirationDate,
                readerExpirationDate,
                maxNumberOfLicenses,
                maxPublicCount,
                customerInfo,
                htmlHeadContent,
            }
        };
        return this.handleRequest("update", options);
    }

    getAccountsForUser(userId: string, options?: IGetAccountOptions): Promise<Account[]> {
        const reqOptions = {
            pathParams: {
                userId,
                ...(options ? { options: JSON.stringify(options) } : {})
            }
        };
        return this.handleRequest("getAccountsForUser", reqOptions);
    }

    getAccountIdsForUser(userId: string): Promise<string[]> {
        return this.handleRequest("getAccountIdsForUser", {
            pathParams: { userId }
        });
    }

    getAccountIdsForUsersAndGroups(ids: string[]): Promise<Record<string, string[]>> {
        return this.handleRequest("getAccountIdsForUsersAndGroups", {
            body: { ids }
        });
    }

    async mine(options?: IGetAccountOptions): Promise<Account[]> {
        const reqOptions = {
            ...(options ?
                {
                    pathParams: {
                        options: JSON.stringify(options),
                    }
                } :
                {})
        };
        const accounts = await this.handleRequest<Account[]>("mine", reqOptions);
        const processedAccounts = accounts.map(a => ({
            ...a,
            thumbnail: Object.assign(Object.create(Thumbnail.prototype), a.thumbnail),
        }))
        return processedAccounts;
    }

    findAccountsForIds(accountIds: Array<string>, checkAdminPermission = false): Promise<Array<Account>> {
        const options = {
            body: {
                accountIds,
                checkAdminPermission
            }
        };
        return this.handleRequest("findAccountsForIds", options);
    }

    getAccountsForADTenant(tenantId: string): Promise<Account[]> {
        const options = {
            pathParams: {
                tenantId: encodeURIComponent(tenantId)
            }
        };
        return this.handleRequest("getAccountsForADTenant", options);
    }


    setAccountSubscription(accountId: string, subscriptionId: string): Promise<Account> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                subscriptionId
            }
        };
        return this.handleRequest("setAccountSubscription", options);
    }

    getAccountSettings(accountId: string): Promise<IAccountSettings> {
        const options = {
            pathParams: {
                accountId
            }
        };
        return this.handleRequest("getAccountSettings", options);
    }

    getPublicAccountSettings(accountId: string): Promise<IPublicAccountSettings> {
        const options = {
            pathParams: {
                accountId
            }
        };
        return this.handleRequest("getPublicAccountSettings", options);
    }

    setAccountDefaultLanguageSettings(accountId: string, languageSettings: ILanguageAccountSettings): Promise<void> {

        const options = {
            pathParams: {
                accountId
            },
            body: {
                languageSettings
            }
        };
        return this.handleRequest<void>("setAccountDefaultLanguageSettings", options);
    }

    setAccountDefaultInterfaceLanguage(accountId: string, languageSettings: ILanguageAccountSettings): Promise<void> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                languageSettings
            }
        };
        return this.handleRequest<void>("setAccountDefaultInterfaceLanguage", options);
    }

    setAccountDefaultPDFExportSettings(accountId: string, settings: IPDFExportAccountSettings): Promise<void> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                settings
            }
        };
        return this.handleRequest<void>("setAccountDefaultPDFExportSettings", options);
    }

    setAccountSecuritySettings(accountId: string, settings: SecuritySettings): Promise<void> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                settings
            }
        };
        return this.handleRequest<void>("setAccountSecuritySettings", options);
    }

    setAccountAG5Settings(accountId: string, settings: AG5Settings): Promise<void> {
        const options = {
            body: {
                accountId,
                settings
            }
        };
        return this.handleRequest<void>("setAccountAG5Settings", options);
    }

    setAccountMTSettings(accountId: string, settings: IMTAccountSettings): Promise<void> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                settings
            }
        };
        return this.handleRequest<void>("setAccountMTSettings", options);
    }

    setAccountSortMethod(accountId: string, sortMethod: AccountSortMethod): Promise<void> {
        const options = {
            pathParams: { accountId },
            body: { sortMethod }
        }
        return this.handleRequest("setAccountSortMethod", options);
    }

    setAccountMTSettingsLanguagePair(
        accountId: string,
        languageCodesSerialized: string,
        engineType: MTEngineType | null,
        replacesLanguageCodesSerialized?: string,
    ): Promise<IMTAccountSettings> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                languageCodesSerialized,
                replacesLanguageCodesSerialized,
                engineType,
            }
        };
        return this.handleRequest("setAccountMTSettingsLanguagePair", options);
    }

    setSSOSettings(accountId: string, ssoSettings: ISAMLSSOSettings): Promise<void> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                ssoSettings
            }
        };
        return this.handleRequest<void>("setSSOSettings", options);
    }

    getSSOSettings(accountId: string): Promise<ISAMLSSOSettings> {
        const options = {
            pathParams: {
                accountId
            }
        };
        return this.handleRequest("getSSOSettings", options);
    }

    setAccountDefaultVisualSettings(accountId: string, visualSettings: IVisualsAccountSettings): Promise<void> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                visualSettings
            }
        };
        return this.handleRequest<void>("setAccountDefaultVisualSettings", options);
    }

    getAccountFeatures(accountId: string): Promise<Array<string>> {
        const options = {
            pathParams: {
                accountId
            },
        };
        return this.handleRequest("getAccountFeatures", options);
    }

    getAccountFeaturesUsage(): Promise<IFeatureUsage> {
        return this.handleRequest("getAccountFeaturesUsage", {});
    }

    setAccountFeatures(accountId: string, features: string[], options?: IUpdateFeaturesOptions): Promise<void> {
        const reqOptions = {
            pathParams: {
                accountId,
            },
            body: {
                features,
                options,
            }
        };
        return this.handleRequest("setAccountFeatures", reqOptions);
    }

    updateTotalPublicDocumentLicensing(accountId: string): Promise<void> {
        const reqOptions = {
            pathParams: {
                accountId,
            },
        };
        return this.handleRequest("updateTotalPublicDocumentLicensing", reqOptions);
    }

    findExceedingLimitsLicensing(): Promise<AccountLicensing[]> {
        return this.handleRequest("findExceedingLimitsLicensing", {});
    }

    getAccountLicensing(accountId: string): Promise<AccountLicensing> {
        const options = {
            pathParams: {
                accountId,
            },
        };
        return this.handleRequest("getAccountLicensing", options);
    }

    async getHelpAccount(options?: IGetAccountOptions): Promise<Account> {
        const reqOptions = {
            ...(options ?
                {
                    pathParams: {
                        options: JSON.stringify(options),
                    }
                } :
                {})
        };
        const account = await this.handleRequest<Account>("getHelpAccount", reqOptions);
        return {
            ...account,
            thumbnail: Object.assign(Object.create(Thumbnail.prototype), account.thumbnail)
        }
    }

    async findAccountMemberships(accountId: string): Promise<IAccountMembership[]> {
        const options = {
            pathParams: { accountId },
        };
        const response: IAccountMembership[] = await this.handleRequest("findAccountMemberships", options);
        return response.map(accountMembership => ({
            ...accountMembership,
            start: new Date(accountMembership.start),
            end: accountMembership.end ? new Date(accountMembership.end) : undefined,
        }));
    }

    updateStorageDetails(accountId: string, storageDetails: IAccountStorageDetails): Promise<Account> {
        const options = {
            pathParams: {
                accountId
            },
            body: {
                storageDetails
            }
        };
        return this.handleRequest("updateStorageDetails", options)
    }

    createMSTransactableSetupRequest(
        createParams: CreateMSAccountSetupRequestParams
    ): Promise<void> {
        const options = {
            body: {
                params: createParams
            }
        }
        return this.handleRequest("createMSTransactableSetupRequest", options);
    }

    msTransactableOffersFullfillmentWebhook(/* data: MSTransactableOffersFullfillmentWebhookData */): Promise<void> {
        throw new Error(
            "msTransactableOffersFullfillmentWebhook is a webhook endpoint for transactable offers and should not be used directly."
        );
    }

    resolveMSPurchaseIdToken(purchaseIdToken: string): Promise<ResolveMSPurchaseIdTokenResponse> {
        const options = {
            pathParams: {
                purchaseIdToken: encodeURIComponent(purchaseIdToken)
            }
        }
        return this.handleRequest("resolveMSPurchaseIdToken", options);
    }

    createMSTransactableSubscription(
        createParams: IMSTransactableSubscription
    ): Promise<void> {
        const options = {
            body: createParams
        }
        return this.handleRequest("createMSTransactableSubscription", options);
    }

    listMSTransactableSetupRequests(): Promise<IMSAccountSetupRequest[]> {
        return this.handleRequest("listMSTransactableSetupRequests", {});
    }

    getAccountSubscriptionByAccountId(accountId: string): Promise<IMSTransactableSubscription> {
        const options = {
            pathParams: {
                accountId
            }
        }
        return this.handleRequest("getAccountSubscriptionByAccountId", options);
    }

    setAnonymised(accountId: string, isAnonymised: boolean): Promise<Account> {
        return this.handleRequest("setAnonymised", {
            pathParams: { accountId },
            body: { isAnonymised }
        })
    }

    getAllFeaturesByAccount(): Promise<FeaturesByAccount> {
        return this.handleRequest("getAllFeaturesByAccount", {})
    }

    getAccountsByFeatures(features: IFeature[]): Promise<Account[]> {
        return this.handleRequest("getAccountsByFeatures", {
            body: { features },
        });
    }

    bootstrapTrialEnvironment(props: BootstrapTrialEnvironmentProps): Promise<void> {
        return this.handleRequest("bootstrapTrialEnvironment", {
            body: props,
        })
    }

    getLaunchDarklyFlagsForFrontend(accountId: string): Promise<Record<LDFlags, unknown>> {
        return this.handleRequest("getLaunchDarklyFlagsForFrontend", {
            body: { accountId },
        })
    }
}
