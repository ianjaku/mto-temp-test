import {
    Account,
    AccountServiceContract,
    ICustomer,
    ManageMemberTrigger
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    AccountAdminParamsOrBody,
    AccountMemberParams,
    Allow
} from "@binders/binders-service-common/lib/middleware/authorization";
import { AccountService, AccountServiceFactory } from "./service";
import {
    ApplicationToken,
    ApplicationTokenOrPublic,
    Public
} from "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuditLogType,
    FeatureActionType,
    TrackingServiceContract
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { AuthorizationServiceContract } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import getAppRoutes from "@binders/client/lib/clients/accountservice/v1/routes";
import { getClientIps } from "@binders/binders-service-common/lib/util/ip";
import { validateUserId } from "@binders/client/lib/clients/validation";

export default function getServiceRoutes(
    accountServiceFactory: AccountServiceFactory,
    azContract: AuthorizationServiceContract,
    trackingServiceContract: TrackingServiceContract,
): { [name in keyof AccountServiceContract]: ServiceRoute } {
    const appRoutes = getAppRoutes();

    function withService<T>(f: (service: AccountService, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function(request: WebRequest) {
            const service = accountServiceFactory.forRequest(request);
            return f(service, request);
        };
    }

    const AccountMember = (request: WebRequest) => {
        const service = accountServiceFactory.forRequest(request);
        return AccountMemberParams(service)(request);
    }

    const parseOptions = (optionsCandidate: string) => {
        try {
            return JSON.parse(optionsCandidate);
        } catch {
            return {};
        }
    }

    const logAuditLogForAccountUpdate = (
        request: WebRequest,
        logType: AuditLogType,
        manageMemberTrigger: ManageMemberTrigger,
        userId?: string,
    ) => {
        const reqUserId = request.body.fromUserId || request?.user?.userId;
        const uId = validateUserId(reqUserId).length !== 0 ? "public" : reqUserId;
        trackingServiceContract.logAuditLog(
            logType,
            uId,
            request.params.accountId,
            request.body.fromUserAgent || request?.["headers"]?.["user-agent"],
            {
                userId: userId || request.body.userId,
                manageMemberTrigger
            },
            request.body.fromUserIp || getClientIps(request),
        );
    };

    const logAuditLogForFeaturesUpdate = (request: WebRequest, featureAction: FeatureActionType) => {
        trackingServiceContract.logAuditLog(
            AuditLogType.FEATURE_UPDATE,
            request.user && request.user.userId,
            request.params.accountId,
            request["headers"] && request["headers"]["user-agent"],
            {
                featureAction,
                feature: request.body.feature,
            },
            getClientIps(request),
        );
    };

    return {
        listAccounts: {
            ...appRoutes.listAccounts,
            serviceMethod: withService<Account[]>(
                (service, request) => service.listAccounts(`${request.query.includeHtmlHeadContent}` === "1")
            ),
        },
        findAccounts: {
            ...appRoutes.findAccounts,
            serviceMethod: withService<Account[]>(
                (service, request) => service.findAccounts(request.body.filter)
            ),
        },
        createAccount: {
            ...appRoutes.createAccount,
            serviceMethod: withService<Account>(
                (service, request) => service.createAccount(
                    request.body.name,
                    request.body.subscriptionType,
                    request.body.expirationDate,
                    request.body.readerExpirationDate,
                    request.body.maxNumberOfLicenses,
                    request.body.maxPublicCount,
                    request.body.customerInfo,
                    request.body.id,
                    request.body.features,
                    request.body.htmlHeadContent,
                    request.user && request.user.userId,
                )
            ),
        },
        getAccount: {
            ...appRoutes.getAccount,
            serviceMethod: withService<Account>((service, request) => service.getAccount(request.params.accountId)),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        addMember: {
            ...appRoutes.addMember,
            serviceMethod: withService((service, request) => {
                logAuditLogForAccountUpdate(
                    request,
                    AuditLogType.ACCOUNT_MEMBER_ADDED,
                    request.body.manageMemberTrigger,
                );
                return service.addMember(
                    request.params.accountId,
                    request.body.userId,
                    request.body.manageMemberTrigger,
                    request.body.skipDefaultPermissions,
                    request.body.fromUserId || request.user && request.user.userId,
                    request.body.fromUserIp || getClientIps(request),
                    request.body.fromUserAgent || request["headers"] && request["headers"]["user-agent"],
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        addMembers: {
            ...appRoutes.addMembers,
            serviceMethod: withService((service, request) => {
                const { userIds } = request.body;
                userIds.forEach(userId => {
                    logAuditLogForAccountUpdate(
                        request,
                        AuditLogType.ACCOUNT_MEMBER_ADDED,
                        request.body.manageMemberTrigger,
                        userId,
                    );
                });
                return service.addMembers(
                    request.params.accountId,
                    userIds,
                    request.body.manageMemberTrigger,
                    request.body.fromUserId || request.user && request.user.userId,
                    request.body.fromUserIp || getClientIps(request),
                    request.body.fromUserAgent || request["headers"] && request["headers"]["user-agent"],
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        removeMember: {
            ...appRoutes.removeMember,
            serviceMethod: withService((service, request) => {
                logAuditLogForAccountUpdate(
                    request,
                    AuditLogType.ACCOUNT_MEMBER_REMOVED,
                    request.body.manageMemberTrigger,
                );
                return service.removeMember(
                    request.params.accountId,
                    request.body.userId,
                    request.body.manageMemberTrigger,
                    request["headers"] && request["headers"]["user-agent"],
                    request.user && request.user.userId,
                    getClientIps(request),
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        removeMembers: {
            ...appRoutes.removeMembers,
            serviceMethod: withService((service, request) => {
                const userIds = request.body.userIds;
                userIds.forEach(userId => {
                    logAuditLogForAccountUpdate(
                        request,
                        AuditLogType.ACCOUNT_MEMBER_REMOVED,
                        request.body.manageMemberTrigger,
                        userId,
                    );
                });
                return service.removeMembers(
                    request.params.accountId,
                    request.body.userIds,
                    request.body.manageMemberTrigger,
                    request["headers"] && request["headers"]["user-agent"],
                    request.user && request.user.userId,
                    getClientIps(request),
                );
            })
        },
        update: {
            ...appRoutes.update,
            serviceMethod: withService(
                (service, request) => service.update(
                    request.params.accountId,
                    request.body.name,
                    request.body.subscriptionType,
                    request.body.expirationDate,
                    request.body.readerExpirationDate,
                    request.body.maxNumberOfLicenses,
                    request.body.maxPublicCount,
                    request.body.customerInfo,
                    request.body.htmlHeadContent,
                    request.body.userId,
                )
            ),
        },
        getAccountsForUser: {
            ...appRoutes.getAccountsForUser,
            serviceMethod: withService((service, request) => {
                const options = parseOptions(request.params.options);
                return service.getAccountsForUser(request.params.userId, {
                    checkForAdminPermission: false,
                    ...options,
                });
            }),
        },
        getAccountIdsForUser: {
            ...appRoutes.getAccountIdsForUser,
            serviceMethod: withService((service, request) => {
                return service.getAccountIdsForUser(request.params.userId)
            }),
        },
        getAccountIdsForUsersAndGroups: {
            ...appRoutes.getAccountIdsForUsersAndGroups,
            serviceMethod: withService((service, request) => {
                return service.getAccountIdsForUsersAndGroups(request.body.ids)
            }),
        },
        mine: {
            ...appRoutes.mine,
            serviceMethod: withService((service, request) => {
                const options = parseOptions(request.params.options);
                return service.getAccountsForUser(request.user.userId, {
                    ...options,
                    checkForAdminPermission: true,
                });
            }),
            authentication: ApplicationToken,
            authorization: Allow
        },
        findAccountsForIds: {
            ...appRoutes.findAccountsForIds,
            serviceMethod: withService((service, request) => service.findAccountsForIds(request.body.accountIds)),
        },
        getAccountsForADTenant: {
            ...appRoutes.getAccountsForADTenant,
            serviceMethod: withService((service, request) => service.getAccountsForADTenant(decodeURIComponent(request.params.tenantId))),
        },
        setAccountSubscription: {
            ...appRoutes.setAccountSubscription,
            serviceMethod: withService((service, request) => service.setAccountSubscription(request.params.accountId, request.body.subscriptionId)),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        getAccountSettings: {
            ...appRoutes.getAccountSettings,
            serviceMethod: withService((service, request) => service.getAccountSettings(request.params.accountId, request.user)),
            authentication: ApplicationToken,
            authorization: AccountMember
        },
        getPublicAccountSettings: {
            ...appRoutes.getPublicAccountSettings,
            serviceMethod: withService((service, request) => service.getPublicAccountSettings(request.params.accountId)),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        setAccountDefaultVisualSettings: {
            ...appRoutes.setAccountDefaultVisualSettings,
            serviceMethod: withService((service, request) => service.setAccountDefaultVisualSettings(request.params.accountId, request.body.visualSettings)),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setAccountDefaultLanguageSettings: {
            ...appRoutes.setAccountDefaultLanguageSettings,
            serviceMethod: withService((service, request) => service.setAccountDefaultLanguageSettings(request.params.accountId, request.body.languageSettings)),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setAccountDefaultInterfaceLanguage: {
            ...appRoutes.setAccountDefaultInterfaceLanguage,
            serviceMethod: withService((service, request) => service.setAccountDefaultInterfaceLanguage(request.params.accountId, request.body.languageSettings)),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setAccountDefaultPDFExportSettings: {
            ...appRoutes.setAccountDefaultPDFExportSettings,
            serviceMethod: withService((service, request) =>
                service.setAccountDefaultPDFExportSettings(
                    request.params.accountId,
                    request.body.settings,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setAccountMTSettings: {
            ...appRoutes.setAccountMTSettings,
            serviceMethod: withService((service, request) =>
                service.setAccountMTSettings(
                    request.params.accountId,
                    request.body.settings,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setAccountSecuritySettings: {
            ...appRoutes.setAccountSecuritySettings,
            serviceMethod: withService((service, request) =>
                service.setAccountSecuritySettings(
                    request.params.accountId,
                    request.body.settings,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setAccountAG5Settings: {
            ...appRoutes.setAccountAG5Settings,
            serviceMethod: withService((service, request) =>
                service.setAccountAG5Settings(
                    request.body.accountId,
                    request.body.settings,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setAccountSortMethod: {
            ...appRoutes.setAccountSortMethod,
            serviceMethod: withService((service, request) =>
                service.setAccountSortMethod(
                    request.params.accountId,
                    request.body.sortMethod,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setAccountMTSettingsLanguagePair: {
            ...appRoutes.setAccountMTSettingsLanguagePair,
            serviceMethod: withService((service, request) =>
                service.setAccountMTSettingsLanguagePair(
                    request.params.accountId,
                    request.body.languageCodesSerialized,
                    request.body.engineType,
                    request.body.replacesLanguageCodesSerialized,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setSSOSettings: {
            ...appRoutes.setSSOSettings,
            serviceMethod: withService((service, request) => service.setSSOSettings(request.params.accountId, request.body.ssoSettings)),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        getSSOSettings: {
            ...appRoutes.getSSOSettings,
            serviceMethod: withService((service, request) => service.getSSOSettings(request.params.accountId)),
            authentication: ApplicationToken,
            authorization: AccountMember
        },
        linkFeature: {
            ...appRoutes.linkFeature,
            serviceMethod: withService((service, request) => {
                logAuditLogForFeaturesUpdate(request, FeatureActionType.FEATURE_ADDED);
                return service.linkFeature(
                    request.params.accountId,
                    request.body.feature,
                    request.user?.userId
                );
            }),
        },
        unlinkFeature: {
            ...appRoutes.unlinkFeature,
            serviceMethod: withService((service, request) => {
                logAuditLogForFeaturesUpdate(request, FeatureActionType.FEATURE_REMOVED);
                return service.unlinkFeature(
                    request.params.accountId,
                    request.body.feature,
                    request.user?.userId
                );
            }),
        },
        getAccountFeatures: {
            ...appRoutes.getAccountFeatures,
            serviceMethod: withService((service, request) => service.getAccountFeatures(request.params.accountId)),
            authentication: Public,
            authorization: Allow
        },
        getAccountFeaturesUsage: {
            ...appRoutes.getAccountFeaturesUsage,
            serviceMethod: withService((service) => (
                service.getAccountFeaturesUsage()
            )),
        },
        setAccountFeatures: {
            ...appRoutes.setAccountFeatures,
            serviceMethod: withService((service, request) => service.setAccountFeatures(request.params.accountId, request.body.features, request.body.options)),
        },
        updateTotalPublicDocumentLicensing: {
            ...appRoutes.updateTotalPublicDocumentLicensing,
            serviceMethod: withService((service, req) => service.updateTotalPublicDocumentLicensing(
                req.params.accountId,
            )),
        },
        findExceedingLimitsLicensing: {
            ...appRoutes.findExceedingLimitsLicensing,
            serviceMethod: withService((service) => service.findExceedingLimitsLicensing()),
        },
        getAccountLicensing: {
            ...appRoutes.getAccountLicensing,
            serviceMethod: withService(
                (service, req) => service.getAccountLicensing(req.params.accountId),
            ),
            authentication: ApplicationToken,
            authorization: AccountMember,
        },
        getHelpAccount: {
            ...appRoutes.getHelpAccount,
            serviceMethod: withService((service, req) => service.getHelpAccount(parseOptions(req.params.options))),
            authentication: ApplicationToken,
            authorization: Allow,
        },
        generateUserTokenSecretForAccountId: {
            ...appRoutes.generateUserTokenSecretForAccountId,
            serviceMethod: withService((service, req) => service.generateUserTokenSecretForAccountId(req.body.accountId)),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract),
        },
        findAccountMemberships: {
            ...appRoutes.findAccountMemberships,
            serviceMethod: withService((service, req) => service.findAccountMemberships(req.params.accountId)),
        },
        updateStorageDetails: {
            ...appRoutes.updateStorageDetails,
            serviceMethod: withService((service, req) => service.updateStorageDetails(req.params.accountId, req.body.storageDetails)),
        },
        createMSTransactableSetupRequest: {
            ...appRoutes.createMSTransactableSetupRequest,
            serviceMethod: withService((service, req) => service.createMSTransactableSetupRequest(req.body.params)),
            authentication: Public,
            authorization: Allow
        },
        listMSTransactableSetupRequests: {
            ...appRoutes.listMSTransactableSetupRequests,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            serviceMethod: withService((service, req) => service.listMSTransactableSetupRequests()),
        },
        msTransactableOffersFullfillmentWebhook: {
            ...appRoutes.msTransactableOffersFullfillmentWebhook,
            serviceMethod: withService((service, req) => service.msTransactableOffersFullfillmentWebhook(req.body)),
            authentication: Public,
            authorization: Allow
        },
        getAccountSubscriptionByAccountId: {
            ...appRoutes.getAccountSubscriptionByAccountId,
            serviceMethod: withService((service, req) => service.getAccountSubscriptionByAccountId(req.params.accountId)),
        },
        createMSTransactableSubscription: {
            ...appRoutes.createMSTransactableSubscription,
            serviceMethod: withService((service, req) => service.createMSTransactableSubscription(req.body)),
        },
        resolveMSPurchaseIdToken: {
            ...appRoutes.resolveMSPurchaseIdToken,
            serviceMethod: withService((service, req) => service.resolveMSPurchaseIdToken(req.params.purchaseIdToken)),
            authentication: Public,
            authorization: Allow
        },
        listCustomers: {
            ...appRoutes.listCustomers,
            serviceMethod: withService<ICustomer[]>(
                (service) => service.listCustomers()
            ),
        },
        findCustomers: {
            ...appRoutes.findCustomers,
            serviceMethod: withService<ICustomer[]>(
                (service, request) => service.findCustomers(JSON.parse(request.body.query))
            ),
        },
        createCustomer: {
            ...appRoutes.createCustomer,
            serviceMethod: withService<ICustomer>(
                (service, request) => service.createCustomer(
                    request.body.name,
                    request.body.crmCustomerId,
                    request.body.doCreateAccount,
                    request.user && request.user.userId,
                )
            ),
        },
        updateCustomer: {
            ...appRoutes.updateCustomer,
            serviceMethod: withService(
                (service, request) => service.updateCustomer(
                    request.params.customerId,
                    request.body.name,
                    request.body.crmCustomerId,
                )
            ),
        },
        deleteCustomer: {
            ...appRoutes.deleteCustomer,
            serviceMethod: withService(
                (service, request) => service.deleteCustomer(
                    request.params.customerId,
                )
            ),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        removeAccountFromCustomer: {
            ...appRoutes.removeAccountFromCustomer,
            serviceMethod: withService((service, request) => {
                return service.removeAccountFromCustomer(
                    request.params.customerId,
                    request.body.accountId,
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        addAccountToCustomer: {
            ...appRoutes.addAccountToCustomer,
            serviceMethod: withService((service, request) => {
                return service.addAccountToCustomer(
                    request.params.customerId,
                    request.body.accountId,
                );
            }),
            authentication: ApplicationToken,
            authorization: AccountAdminParamsOrBody(azContract)
        },
        setAnonymised: {
            ...appRoutes.setAnonymised,
            serviceMethod: withService(
                (service, request) => {
                    const accountId = request.params.accountId;
                    const isAnonymised = request.body.isAnonymised;
                    return service.setAnonymised(accountId, isAnonymised);
                }
            ),
        },
        deleteAccount: {
            ...appRoutes.deleteAccount,
            serviceMethod: withService(
                (service, request) => service.deleteAccount(
                    request.params.accountId
                )
            ),
        },
        getAllFeaturesByAccount: {
            ...appRoutes.getAllFeaturesByAccount,
            serviceMethod: withService(
                (service) => {
                    return service.getAllFeaturesByAccount();
                }
            ),
        },
        getAccountsByFeatures: {
            ...appRoutes.getAccountsByFeatures,
            serviceMethod: withService(
                (service, request) => {
                    const features = request.body.features;
                    return service.getAccountsByFeatures(features);
                }
            ),
        },
        bootstrapTrialEnvironment: {
            ...appRoutes.bootstrapTrialEnvironment,
            serviceMethod: withService(
                (service, request) => {
                    return service.bootstrapTrialEnvironment(request.body);
                }
            ),
        },
        getLaunchDarklyFlagsForFrontend: {
            ...appRoutes.getLaunchDarklyFlagsForFrontend,
            serviceMethod: withService(
                (service, request) => {
                    const accountId = request.body.accountId;
                    return service.getLaunchDarklyFlagsForFrontend(
                        accountId,
                        request.user?.userId,
                    );
                }
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: Allow,
        }
    };
}
