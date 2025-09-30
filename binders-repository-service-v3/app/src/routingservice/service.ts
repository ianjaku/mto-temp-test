import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    DeleteSemanticLinkFilter,
    DomainFilter,
    GetDomainFiltersForAccountsOptions,
    IPWhitelist,
    ISemanticLink,
    ISemanticLinkRequest,
    ReaderBranding,
    RoutingServiceContract,
    SetSemanticLinkResult,
} from "@binders/client/lib/clients/routingservice/v1/contract";
import {
    DomainFilterRepository,
    DomainFilterRepositoryFactory
} from "./repositories/domainfilter";
import { DomainNotFound, SemanticLink } from "./model";
import { IPWhitelistRepository, IPWhitelistRepositoryFactory } from "./repositories/ipwhitelist";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    ReaderBrandingRepository,
    ReaderBrandingRepositoryFactory
} from "./repositories/readerbranding";
import { RedisClient, RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import {
    SemanticLinkRepository,
    SemanticLinkRepositoryFactory,
    ServerSemanticLinkFilter
} from "./repositories/semanticlink";
import TokenAcl, {
    AccountAclScope
} from "@binders/client/lib/clients/authorizationservice/v1/tokenacl";
import {
    buildTokenUrl,
    maybeUpdateHostInProductionUrl
} from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import { getFullPrefixForFile, redisKeys } from "@binders/client/lib/branding/redisKeys";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { AccountSummary } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BaseStyleProps } from "@binders/binders-service-common/lib/style/base";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { Config } from "@binders/client/lib/config/config";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { RedisCssRepository } from "@binders/binders-service-common/lib/style/cssRepository";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import moment from "moment";


export class RoutingService implements RoutingServiceContract {
    constructor(private readonly logger: Logger,
        private readonly domainFilterRepo: DomainFilterRepository,
        private readonly readerBrandingRepo: ReaderBrandingRepository,
        private readonly cssBuilders: RedisCssRepository<BaseStyleProps>[],
        private readonly semanticLinkRepo: SemanticLinkRepository,
        private readonly repoServiceClient: BinderRepositoryServiceClient,
        private readonly accountServiceClient: AccountServiceClient,
        private readonly credentialServiceClient: CredentialServiceClient,
        private readonly ipWhitelistRepo: IPWhitelistRepository,
    ) {
    }

    /**
     * remove empty stylus override props so they're not included (blank) as css variables
     */
    removeEmptyStylusOverrides(branding: ReaderBranding): void {
        branding.stylusOverrideProps = Object.entries(branding.stylusOverrideProps).reduce((acc, [prop, val]) => {
            if (val) {
                acc[prop] = val;
            }
            return acc;
        }, {});
    }

    async maybeInjectLogoToken(
        branding: ReaderBranding,
        imageServiceExternalLocation?: string,
        accountIdForDomain?: string,
    ): Promise<void> {
        if (branding.logo && branding.logo.url && !branding.logo.url.startsWith("data:")) {
            let accountId;
            try {
                const accountIds = accountIdForDomain || await this.getAccountIdsForDomain(branding.domain);
                accountId = accountIds[0];
            } catch (ex) {
                if (ex.name === DomainNotFound.NAME) {
                    return;
                }
                throw new Error(ex);
            }
            const token = await this.credentialServiceClient.createUrlToken(TokenAcl.fromAccountId(accountId, [AccountAclScope.BRANDING]), 1);
            branding.logo = {
                ...branding.logo,
                url: buildTokenUrl(maybeUpdateHostInProductionUrl(branding.logo.url, imageServiceExternalLocation), token),
            }
        }
    }

    async getBrandingForReaderDomain(domain: string, imageServiceExternalLocation?: string): Promise<ReaderBranding> {
        const branding = await this.readerBrandingRepo.getReaderBranding(domain);
        this.removeEmptyStylusOverrides(branding);
        await this.maybeInjectLogoToken(branding, imageServiceExternalLocation);
        return branding;
    }

    async getBrandingsForDomainFilters(
        domainFilters: DomainFilter[],
        imageServiceExternalLocation?: string,
    ): Promise<ReaderBranding[]> {
        const brandings = await this.readerBrandingRepo.getReaderBrandings(domainFilters.map(df => df.domain));
        for (const branding of brandings) {
            await this.maybeInjectLogoToken(branding, imageServiceExternalLocation, domainFilters.find(df => df.domain === branding.domain)?.accountId);
        }
        return brandings;
    }

    setBrandingForReaderDomain(domain: string, branding: ReaderBranding): Promise<void> {
        return this.readerBrandingRepo.saveReaderBranding(domain, branding);
    }

    toClientSemanticLink(semanticLinkModel: SemanticLink): ISemanticLink {
        return {
            ...semanticLinkModel,
            id: semanticLinkModel.id.value(),
        }
    }

    async findSemanticLinks(binderId: string): Promise<Array<ISemanticLink>> {
        const semanticLinks = await this.semanticLinkRepo.findSemanticLinks({ binderId });
        return semanticLinks.map(sl => this.toClientSemanticLink(sl));
    }

    async findSemanticLinksMulti(binderIds: string[]): Promise<{ [binderId: string]: ISemanticLink[] }> {
        const semanticLinks = await this.semanticLinkRepo.findSemanticLinksMulti({ binderIds });
        return Object.entries(semanticLinks).reduce((acc, [binderId, semanticLinks]) => ({
            ...acc,
            [binderId]: semanticLinks.map(sl => this.toClientSemanticLink(sl))
        }), {});
    }

    async getSemanticLinkById(domain: string, semanticId: string): Promise<ISemanticLink[]> {
        // first try with exact match for speed
        let semanticLinks = await this.semanticLinkRepo.findSemanticLinks({ domain, semanticIdCaseSensitive: semanticId });
        if (!semanticLinks.length) {
            const semanticIdRegex = `^${escapeRegExp(semanticId)}$`
            const filter: ServerSemanticLinkFilter = {
                domain,
                semanticIdRegex,
                semanticIdRegexOptions: "i"
            }
            semanticLinks = await this.semanticLinkRepo.findSemanticLinks(filter);
        }
        return semanticLinks.map(sl => this.toClientSemanticLink(sl));
    }

    async ensureSemanticLinks(semanticLinkRequests: ISemanticLinkRequest[]): Promise<void> {
        await this.semanticLinkRepo.ensureSemanticLinks(semanticLinkRequests);
    }

    async identifyLanguageInSemanticLinks(domain: string, itemId: string, languageCode: string): Promise<ISemanticLink[]> {
        const semanticLinks = await this.semanticLinkRepo.relabelLanguageInSemanticLinks(domain, itemId, UNDEFINED_LANG, languageCode);
        return semanticLinks.map(sl => this.toClientSemanticLink(sl));
    }

    async setSemanticLink(semanticLink: Omit<ISemanticLink, "id">, binderId: string, overrideInTrash = false): Promise<SetSemanticLinkResult> {
        if (semanticLink.binderId !== binderId) {
            throw new Error(`Unexpected ${binderId} and ${semanticLink.binderId} values`);
        }
        const existingSemanticLink = await this.findSemanticLink(semanticLink);
        if (!existingSemanticLink) {
            return this.createSemanticLink(semanticLink);
        }
        if (existingSemanticLink.deleted) {
            return this.updateSemanticLink(existingSemanticLink, semanticLink);
        } else if (this.isAllowedSemanticLinkFieldUpdate(existingSemanticLink, semanticLink)) {
            return this.updateSemanticLink(existingSemanticLink, semanticLink);
        } else {
            const existingSemanticLinkBinderInTrash = await this.isSemanticLinkBinderInTrash(existingSemanticLink);
            if (existingSemanticLinkBinderInTrash && overrideInTrash) {
                return this.updateSemanticLink(existingSemanticLink, semanticLink);
            } else {
                return this.toConflictedResult(existingSemanticLinkBinderInTrash);
            }
        }
    }

    private async findSemanticLink({ domain, semanticId }): Promise<SemanticLink | null> {
        const semanticLinks = await this.semanticLinkRepo.findSemanticLinks({ domain, semanticId });
        if (!semanticLinks?.length) {
            return null;
        }
        const [existingSemanticLink] = semanticLinks;
        return existingSemanticLink;
    }

    private async createSemanticLink(semanticLink: Omit<ISemanticLink, "id">): Promise<SetSemanticLinkResult> {
        const sl = await this.semanticLinkRepo.createSemanticLink(SemanticLink.create(
            semanticLink.binderId,
            semanticLink.languageCode,
            semanticLink.documentType,
            semanticLink.domain,
            semanticLink.semanticId
        ));
        return this.toSuccessfulResult(sl);
    }

    private async updateSemanticLink(existingSemanticLink: SemanticLink, semanticLink: Omit<ISemanticLink, "id">): Promise<SetSemanticLinkResult> {
        const sl = await this.semanticLinkRepo.updateSemanticLink(SemanticLink.from(
            existingSemanticLink.id.value(),
            semanticLink.binderId,
            semanticLink.languageCode,
            semanticLink.documentType,
            semanticLink.domain,
            semanticLink.semanticId,
            semanticLink.deleted
        ));
        return this.toSuccessfulResult(sl);
    }

    private isAllowedSemanticLinkFieldUpdate(existingSemanticLink: SemanticLink, newSemanticLink: Omit<ISemanticLink, "id">): boolean {
        return existingSemanticLink.binderId === newSemanticLink.binderId &&
            existingSemanticLink.languageCode === newSemanticLink.languageCode &&
            existingSemanticLink.documentType === newSemanticLink.documentType &&
            existingSemanticLink.domain === newSemanticLink.domain &&
            existingSemanticLink.semanticId === newSemanticLink.semanticId;
    }

    private async isSemanticLinkBinderInTrash(semanticLink: SemanticLink): Promise<boolean> {
        const binders = await this.repoServiceClient.findItems(
            { ids: [semanticLink.binderId], softDelete: { show: "show-deleted" } },
            { maxResults: 1 });
        if (!binders?.length) {
            return false;
        }
        const [binder] = binders;
        return binder.deletionTime != null;
    }

    private toSuccessfulResult(semanticLink: SemanticLink): SetSemanticLinkResult {
        return { semanticLink: this.toClientSemanticLink(semanticLink) };
    }

    private toConflictedResult(existingSemanticLinkBinderInTrash: boolean): SetSemanticLinkResult {
        return {
            conflict: {
                conflicted: true,
                conflictedWithDeletedItem: existingSemanticLinkBinderInTrash
            }
        };
    }

    deleteSemanticLinks(filter: DeleteSemanticLinkFilter, isSoftDelete = false): Promise<void> {
        return this.semanticLinkRepo.deleteSemanticLinks(filter, isSoftDelete);
    }

    private memoizedAcccountIdsForDomain: string[];
    async getAccountIdsForDomain(domain: string): Promise<string[]> {
        if (!this.memoizedAcccountIdsForDomain) {
            const domainFilter = await this.getDomainFilterByDomain(domain);
            if (domainFilter === undefined) {
                throw new DomainNotFound(domain);
            }
            this.memoizedAcccountIdsForDomain = [domainFilter.accountId];
        }
        return this.memoizedAcccountIdsForDomain;
    }

    async getAccountsForDomain(domain: string): Promise<AccountSummary[]> {
        const accountIds = await this.getAccountIdsForDomain(domain);
        const accounts = await Promise.all(accountIds.map(id => this.accountServiceClient.getAccount(id)));
        const isReaderExpired = (id) => {
            const acc = accounts.find(a => a.id === id);
            if (!acc || !acc.readerExpirationDate) {
                return false;
            }
            return moment().isAfter(moment(acc.readerExpirationDate));
        }
        return accountIds.map(id => ({
            id,
            isReaderExpired: isReaderExpired(id),
        }));
    }

    async updateReaderBranding(id: string, branding: ReaderBranding): Promise<void> {
        try {
            await this.readerBrandingRepo.updateReaderBranding(id, branding);
            await Promise.all(this.cssBuilders.map(b => b.flushCache(branding.domain)));
        } catch (err) {
            this.logger.error(`Failed to update reader branding ${id}`, "createReaderBranding");
            this.logger.logException(err, "createReaderBranding");
            throw err;
        }
    }

    listBrandings(): Promise<Array<ReaderBranding>> {
        return this.readerBrandingRepo.listBrandings();
    }

    listDomainFilters(): Promise<Array<DomainFilter>> {
        return this.domainFilterRepo.listDomainFilters();
    }

    deleteDomainFilter(domain: string): Promise<void> {
        return this.domainFilterRepo.deleteDomainFilter(domain);
    }

    async createReaderBranding(branding: ReaderBranding): Promise<ReaderBranding> {
        try {
            const createdBranding = await this.readerBrandingRepo.createReaderBranding(branding);
            await Promise.all(this.cssBuilders.map(b => b.flushCache(branding.domain)));
            return createdBranding;
        } catch (err) {
            this.logger.error("Failed to create reader branding", "createReaderBranding");
            this.logger.logException(err, "createReaderBranding");
            throw err;
        }
    }

    async deleteReaderBranding(branding: ReaderBranding): Promise<void> {
        await this.readerBrandingRepo.deleteReaderBranding(branding.id)
        await Promise.all(this.cssBuilders.map(b => b.flushCache(branding.domain)));
    }
    async setDomainsForAccount(accountId: string, domains: string[]): Promise<DomainFilter[]> {
        const rootCollections = await this.repoServiceClient.getRootCollections([accountId]);
        const rootCollectionId = rootCollections && rootCollections.length > 0 ? rootCollections[0].id : undefined;
        return this.domainFilterRepo.setDomainsForAccount(accountId, domains, rootCollectionId);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    stripProtocol(url) {
        return url.trim().startsWith("http") ?
            url.split("://")[1] :
            url;
    }

    async getDomainFiltersForAccounts(accountIds: string[], options?: GetDomainFiltersForAccountsOptions): Promise<DomainFilter[]> {
        if (!accountIds) {
            return [];
        }
        const domainFilters = await this.domainFilterRepo.getDomainFiltersForAccounts(accountIds);
        if (options?.includeBranding) {
            const brandings = await this.getBrandingsForDomainFilters(domainFilters);
            domainFilters.forEach(df => {
                df.branding = brandings.find(b => b.domain === df.domain);
            });
        }
        return Promise.resolve(domainFilters);
    }

    getDomainFilterByDomain(domain: string): Promise<DomainFilter> {
        return this.domainFilterRepo.getDomainFilterByDomain(domain);
    }

    getIpWhitelist(domain: string): Promise<IPWhitelist> {
        return this.ipWhitelistRepo.get(domain);
    }

    saveIpWhitelist(whitelist: IPWhitelist): Promise<void> {
        return this.ipWhitelistRepo.save(whitelist);
    }

    async relabelLanguageInSemanticLinks(
        domain: string,
        itemId: string,
        fromLanguageCode: string,
        toLanguageCode: string,
    ): Promise<ISemanticLink[]> {
        const semanticLinks = await this.semanticLinkRepo.relabelLanguageInSemanticLinks(domain, itemId, fromLanguageCode, toLanguageCode);
        return semanticLinks.map(sl => this.toClientSemanticLink(sl));
    }
}

export class RoutingServiceFactory {
    private domainFilterRepoFactory: DomainFilterRepositoryFactory;
    private readerBrandingRepoFactory: ReaderBrandingRepositoryFactory;
    private semanticLinkRepoFactory: SemanticLinkRepositoryFactory;
    private ipwhitelistRepoFactory: IPWhitelistRepositoryFactory;

    constructor(
        private readonly config: Config,
        domainFilterCollectionConfig: CollectionConfig,
        readerBrandingCollectionConfig: CollectionConfig,
        semanticLinkCollectionConfig: CollectionConfig,
        private repoServiceClient: BinderRepositoryServiceClient,
        private accountServiceClient: AccountServiceClient,
        private redisServiceClient: RedisClient,
        private credentialServiceClient: CredentialServiceClient,
        ipWhitelistCollectionConfig: CollectionConfig
    ) {
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        this.domainFilterRepoFactory = new DomainFilterRepositoryFactory(domainFilterCollectionConfig, topLevelLogger);
        this.readerBrandingRepoFactory = new ReaderBrandingRepositoryFactory(readerBrandingCollectionConfig, topLevelLogger);
        this.semanticLinkRepoFactory = new SemanticLinkRepositoryFactory(semanticLinkCollectionConfig, topLevelLogger);
        this.ipwhitelistRepoFactory = new IPWhitelistRepositoryFactory(ipWhitelistCollectionConfig, topLevelLogger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    forRequest(request) {
        const domainFilterRepository = this.domainFilterRepoFactory.build(request.logger);
        const readerBrandingRepository = this.readerBrandingRepoFactory.build(request.logger);
        const semanticLinkRepository = this.semanticLinkRepoFactory.build(request.logger);
        const ipWhitelistRepository = this.ipwhitelistRepoFactory.build(request.logger);
        const cssRepos = Object.keys(redisKeys).map(k => new RedisCssRepository(this.redisServiceClient, getFullPrefixForFile(k), null));

        return new RoutingService(
            request.logger,
            domainFilterRepository,
            readerBrandingRepository,
            cssRepos,
            semanticLinkRepository,
            this.repoServiceClient,
            this.accountServiceClient,
            this.credentialServiceClient,
            ipWhitelistRepository);
    }

    static fromConfig(config: Config): Promise<RoutingServiceFactory> {
        const loginOption = getMongoLogin("routing_service");
        return Promise.all([
            CollectionConfig.promiseFromConfig(config, "domainfilters", loginOption),
            CollectionConfig.promiseFromConfig(config, "readerbranding", loginOption),
            CollectionConfig.promiseFromConfig(config, "semanticlink", loginOption),
            BackendRepoServiceClient.fromConfig(config, "routing-service"),
            BackendAccountServiceClient.fromConfig(config, "routing-service"),
            <RedisClient>RedisClientBuilder.fromConfig(config, "css"),
            BackendCredentialServiceClient.fromConfig(config, "routing-service"),
            CollectionConfig.promiseFromConfig(config, "ipwhitelists", loginOption),
        ])
            .then(([domainFilterCollectionConfig, readerBrandingCollectionConfig, semanticlinkCollectionConfig,
                repoServiceClient, accountServiceClient, redisServiceClient, credentialServiceClient,
                ipWhitelistCollectionConfig]) => {


                return new RoutingServiceFactory(config, domainFilterCollectionConfig, readerBrandingCollectionConfig,
                    semanticlinkCollectionConfig, repoServiceClient, accountServiceClient, redisServiceClient,
                    credentialServiceClient, ipWhitelistCollectionConfig);
            });
    }
}


function escapeRegExp(toEscape): string {
    return toEscape.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
