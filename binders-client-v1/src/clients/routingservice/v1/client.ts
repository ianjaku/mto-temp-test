import { BindersServiceClient, RequestHandler } from "../../client";
import {
    DeleteSemanticLinkFilter,
    DomainFilter,
    GetDomainFiltersForAccountsOptions,
    IPWhitelist,
    ISemanticLink,
    ISemanticLinkRequest,
    ReaderBranding,
    RoutingServiceContract,
    SetSemanticLinkResult
} from "./contract";
import { AccountSummary } from "../../accountservice/v1/contract";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import { TTLCache } from "../../../util/ttlCache";
import getRoutes from "./routes";
import { isProduction } from "../../../util/environment";

export class RoutingServiceClient extends BindersServiceClient implements RoutingServiceContract {

    private iplistCache: TTLCache<string, IPWhitelist>;
    constructor(endpointPrefix: string, requestHandler: RequestHandler, accountIdProvider?: () => string) {
        super(endpointPrefix, getRoutes(), requestHandler, accountIdProvider);
        const ttl = isProduction() ? 300_000 : 5_000;
        this.iplistCache = new TTLCache<string, IPWhitelist>(ttl);
    }

    static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string
    ): RoutingServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "routing", version);
        return new RoutingServiceClient(versionedPath, requestHandler, accountIdProvider);
    }

    getBrandingForReaderDomain(domain: string): Promise<ReaderBranding> {
        const options = {
            pathParams: {
                domain
            }
        };
        return this.handleRequest("getBrandingForReaderDomain", options);
    }

    setBrandingForReaderDomain(domain: string, branding: ReaderBranding): Promise<void> {
        const options = {
            pathParams: {
                domain
            },
            body: {
                branding
            }
        };
        return this.handleRequest<void>("setBrandingForReaderDomain", options);
    }

    updateReaderBranding(id: string, branding: ReaderBranding): Promise<void> {
        const options = {
            pathParams: {
                id,
            },
            body: {
                branding,
            }
        }
        return this.handleRequest<void>("updateReaderBranding", options);
    }

    getAccountIdsForDomain(domain: string): Promise<string[]> {
        const options = {
            pathParams: {
                domain
            }
        };
        return this.handleRequest("getAccountIdsForDomain", options);
    }

    getAccountsForDomain(domain: string): Promise<AccountSummary[]> {
        const options = {
            pathParams: {
                domain
            }
        };
        return this.handleRequest("getAccountsForDomain", options);
    }

    getSemanticLinkById(domain: string, semanticId: string): Promise<ISemanticLink[]> {
        const options = {
            pathParams: {
                domain,
            },
            body: {
                semanticId
            }
        };
        return this.handleRequest("getSemanticLinkById", options);
    }


    findSemanticLinks(binderId: string): Promise<ISemanticLink[]> {
        const options = {
            body: {
                binderId,
            }
        };
        return this.handleRequest("findSemanticLinks", options);
    }

    findSemanticLinksMulti(binderIds: string[]): Promise<{[binderId: string]: ISemanticLink[]}> {
        const options = {
            body: {
                binderIds,
            }
        };
        return this.handleRequest("findSemanticLinksMulti", options);
    }

    ensureSemanticLinks(semanticLinkRequests: ISemanticLinkRequest[]): Promise<void> {
        const options = {
            body: {
                semanticLinkRequests,
            }
        };
        return this.handleRequest("ensureSemanticLinks", options);
    }

    identifyLanguageInSemanticLinks(domain: string, itemId: string, languageCode: string): Promise<ISemanticLink[]> {
        const options = {
            body: {
                domain,
                itemId,
                languageCode
            }
        };
        return this.handleRequest("identifyLanguageInSemanticLinks", options);
    }

    setSemanticLink(
        semanticLink: ISemanticLink,
        binderId: string,
        overrideInTrash?: boolean
    ): Promise<SetSemanticLinkResult> {
        const options = {
            pathParams: {
                id: semanticLink.id,
            },
            body: {
                semanticLink,
                binderId,
                overrideInTrash,
            }
        };
        return this.handleRequest("setSemanticLink", options);
    }

    deleteSemanticLinks(filter: DeleteSemanticLinkFilter, isSoftDelete = false): Promise<void> {
        const options = {
            body: {
                filter,
                isSoftDelete,
            }
        };
        return this.handleRequest("deleteSemanticLinks", options);
    }

    listBrandings(): Promise<Array<ReaderBranding>> {
        return this.handleRequest("listBrandings", {});
    }

    listDomainFilters(): Promise<Array<DomainFilter>> {
        return this.handleRequest("listDomainFilters", {});
    }

    deleteDomainFilter(domain: string): Promise<void> {
        const options = {
            pathParams: {
                domain,
            }
        }
        return this.handleRequest("deleteDomainFilter", options);
    }

    createReaderBranding(branding: ReaderBranding, accountId?: string): Promise<ReaderBranding> {
        const options = { body: { branding, accountId } };
        return this.handleRequest<ReaderBranding>("createReaderBranding", options);
    }

    deleteReaderBranding(branding: ReaderBranding): Promise<void> {
        const options = { body: { branding } };
        return this.handleRequest<void>("deleteReaderBranding", options);
    }

    setDomainsForAccount(accountId: string, domains: string[]): Promise<DomainFilter[]> {
        const options = {
            body: {
                accountId,
                domains
            }
        };
        return this.handleRequest("setDomainsForAccount", options);
    }

    async getDomainFiltersForAccounts(accountIds: string[], options?: GetDomainFiltersForAccountsOptions): Promise<DomainFilter[]> {
        const reqOptions = {
            body: {
                accountIds,
                options,
            }
        };
        return this.handleRequest("getDomainFiltersForAccounts", reqOptions);
    }

    getDomainFilterByDomain(domain: string): Promise<DomainFilter> {
        const options = {
            pathParams: {
                domain
            }
        };
        return this.handleRequest("getDomainFilterByDomain", options);
    }

    getIpWhitelist(domain: string): Promise<IPWhitelist> {
        const options = {
            pathParams: {
                domain
            }
        };
        return this.iplistCache.get(
            domain,
            () => this.handleRequest<IPWhitelist>("getIpWhitelist", options)
        )
    }

    saveIpWhitelist(ipwhitelist: IPWhitelist): Promise<void> {
        const options = {
            body: {
                ipwhitelist
            }
        };
        return this.handleRequest("saveIpWhitelist", options);
    }

    relabelLanguageInSemanticLinks(
        domain: string,
        itemId: string,
        fromLanguageCode: string,
        toLanguageCode: string,
    ): Promise<ISemanticLink[]> {
        const options = {
            body: {
                domain,
                itemId,
                fromLanguageCode,
                toLanguageCode
            }
        };
        return this.handleRequest("relabelLanguageInSemanticLinks", options);
    }
}