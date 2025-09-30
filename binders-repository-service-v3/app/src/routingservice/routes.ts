import {
    AccountFeaturesEnabled,
    AccountsMemberBody,
    Allow,
    Authorization,
    EditDocument,
    MultiAuthorizationOr,
    ViewDocument,
    authorize
} from "@binders/binders-service-common/lib/middleware/authorization";
import {
    AccountServiceContract,
    FEATURE_READ_SCOPES
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    ApplicationToken,
    ApplicationTokenOrPublic,
    Public
} from "@binders/binders-service-common/lib/middleware/authentication";
import { RoutingService, RoutingServiceFactory } from "./service";
import {
    AuthorizationServiceContract
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";
import { ResourceNotFound } from "@binders/client/lib/clients/model";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { documentAuthorization } from "../repositoryservice/authorization";
import getAppRoutes from "@binders/client/lib/clients/routingservice/v1/routes";

export function getServiceRoutes(
    config: Config,
    serviceFactory: RoutingServiceFactory,
    azClient: AuthorizationServiceContract,
    accountClient: AccountServiceContract
): { [name in keyof RoutingServiceContract]: ServiceRoute } {
    const appRoutes = getAppRoutes();
    const { docRead } = documentAuthorization(azClient);

    function withService<T>(f: (service: RoutingService, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function(request: WebRequest) {
            const service = serviceFactory.forRequest(request);
            return f(service, request);
        };
    }

    function docEdit(key: string, keyInBody?: boolean, keyInFilter?: boolean): Authorization {
        return authorize(EditDocument(async req => {
            if (keyInBody) {
                if (keyInFilter && req.body.filter) {
                    return req.body.filter[key];
                }
                return req.body[key];
            }
            return req.params[key];
        }), azClient);
    }


    function semanticLinkRead(): Authorization {
        const extractor = async (request) => {
            const routingService = serviceFactory.forRequest(request);
            const semanticLinks = await routingService.getSemanticLinkById(request.params.domain, request.body.semanticId);
            if (semanticLinks?.length > 0) {
                return semanticLinks[0].binderId;
            }
            throw new ResourceNotFound(`Semantic link does not exist for given params: ${request.params}`);
        };
        // Check if the requesting user has read access to the underlying document
        // OR
        // Shortcut to see if read scopes are enabled
        // (in which case the user only needs access to one of the underlying documents of the collection semantic id)
        return MultiAuthorizationOr([
            authorize(ViewDocument(extractor), azClient),
            AccountFeaturesEnabled(accountClient, [FEATURE_READ_SCOPES])
        ]);
    }


    const AccountsMember = AccountsMemberBody(accountClient);

    return {
        getAccountIdsForDomain: {
            ...appRoutes.getAccountIdsForDomain,
            serviceMethod: withService((service, request) =>
                service.getAccountIdsForDomain(request.params.domain)
            ),
            authentication: Public,
            authorization: Allow
        },
        getAccountsForDomain: {
            ...appRoutes.getAccountsForDomain,
            serviceMethod: withService((service, request) =>
                service.getAccountsForDomain(request.params.domain)
            ),
            authentication: Public,
            authorization: Allow
        },
        setBrandingForReaderDomain: {
            ...appRoutes.setBrandingForReaderDomain,
            serviceMethod: withService((service, request) =>
                service.setBrandingForReaderDomain(request.params.domain, request.body.branding)
            ),
        },
        getBrandingForReaderDomain: {
            ...appRoutes.getBrandingForReaderDomain,
            serviceMethod: withService((service, request) =>
                service.getBrandingForReaderDomain(
                    request.params.domain,
                    config.getString("services.image.externalLocation").getOrElse(undefined),
                )
            ),
        },
        getSemanticLinkById: {
            ...appRoutes.getSemanticLinkById,
            serviceMethod: withService((service, request) =>
                service.getSemanticLinkById(request.params.domain, request.body.semanticId)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: semanticLinkRead()
        },
        findSemanticLinks: {
            ...appRoutes.findSemanticLinks,
            serviceMethod: withService((service, request) =>
                service.findSemanticLinks(request.body.binderId)
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: docRead("binderId", true)
        },
        findSemanticLinksMulti: {
            ...appRoutes.findSemanticLinksMulti,
            serviceMethod: withService((service, request) =>
                service.findSemanticLinksMulti(request.body.binderIds)
            ),
        },
        ensureSemanticLinks: {
            ...appRoutes.ensureSemanticLinks,
            serviceMethod: withService((service, request) =>
                service.ensureSemanticLinks(request.body.semanticLinkRequests)
            ),
        },
        identifyLanguageInSemanticLinks: {
            ...appRoutes.identifyLanguageInSemanticLinks,
            serviceMethod: withService((service, request) =>
                service.identifyLanguageInSemanticLinks(
                    request.body.domain,
                    request.body.itemId,
                    request.body.languageCode,
                )
            ),
            authentication: ApplicationToken,
            authorization: docEdit("itemId", true)
        },
        setSemanticLink: {
            ...appRoutes.setSemanticLink,
            serviceMethod: withService((service, request) =>
                service.setSemanticLink(request.body.semanticLink, request.body.binderId, request.body.overrideInTrash)
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true)
        },
        deleteSemanticLinks: {
            ...appRoutes.deleteSemanticLinks,
            serviceMethod: withService((service, request) =>
                service.deleteSemanticLinks(request.body.filter, request.body.isSoftDelete)
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true, true)
        },
        updateReaderBranding: {
            ...appRoutes.updateReaderBranding,
            serviceMethod: withService((service, request) =>
                service.updateReaderBranding(request.params.id, request.body.branding)
            ),
        },
        listBrandings: {
            ...appRoutes.listBrandings,
            serviceMethod: withService((service) =>
                service.listBrandings()
            ),
        },
        listDomainFilters: {
            ...appRoutes.listDomainFilters,
            serviceMethod: withService((service) =>
                service.listDomainFilters()
            ),
        },
        deleteDomainFilter: {
            ...appRoutes.deleteDomainFilter,
            serviceMethod: withService((service, request) =>
                service.deleteDomainFilter(request.params.domain)
            ),
        },
        createReaderBranding: {
            ...appRoutes.createReaderBranding,
            serviceMethod: withService((service, request) =>
                service.createReaderBranding(request.body.branding)
            ),
        },
        deleteReaderBranding: {
            ...appRoutes.deleteReaderBranding,
            serviceMethod: withService((service, request) =>
                service.deleteReaderBranding(request.body.branding)
            ),
        },
        setDomainsForAccount: {
            ...appRoutes.setDomainsForAccount,
            serviceMethod: withService((service, request) =>
                service.setDomainsForAccount(request.body.accountId, request.body.domains)
            ),
        },
        getDomainFiltersForAccounts: {
            ...appRoutes.getDomainFiltersForAccounts,
            serviceMethod: withService((service, request) =>
                service.getDomainFiltersForAccounts(request.body.accountIds, request.body.options)
            ),
            authentication: ApplicationToken,
            authorization: AccountsMember,
        },
        getDomainFilterByDomain: {
            ...appRoutes.getDomainFilterByDomain,
            serviceMethod: withService((service, request) =>
                service.getDomainFilterByDomain(request.params.domain)
            ),
        },
        getIpWhitelist: {
            ...appRoutes.getIpWhitelist,
            serviceMethod: withService((service, request) =>
                service.getIpWhitelist(request.params.domain)
            ),
        },
        saveIpWhitelist: {
            ...appRoutes.saveIpWhitelist,
            serviceMethod: withService((service, request) =>
                service.saveIpWhitelist(request.body.ipwhitelist)
            ),
        },
        relabelLanguageInSemanticLinks: {
            ...appRoutes.relabelLanguageInSemanticLinks,
            serviceMethod: withService((service, request) =>
                service.relabelLanguageInSemanticLinks(
                    request.body.domain,
                    request.body.itemId,
                    request.body.fromLanguageCode,
                    request.body.toLanguageCode
                )
            ),
        }
    };
}
