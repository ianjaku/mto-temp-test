import {
    BackendAccountServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "../apiclient/backendclient";
import { DomainFilter, RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { IProxyConfig, IProxyDomainConfigWithDomain } from "../middleware/config";
import { isDev, isProduction, isStaging } from "@binders/client/lib/util/environment";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "../bindersconfig/binders";
import { Request } from "express";
import { WebRequest } from "../middleware/request";

const DEFAULT_DEV_DOMAIN = process.env.MANUALTO_DEFAULT_DOMAIN || "demo.manual.to";
const DEV_READER = "localhost:8006";
const DEV_EDITOR = "localhost:8010";

function queryParamAsString(query: WebRequest["query"], paramName: string): string | undefined {
    const value = query[paramName];
    return Array.isArray(value) ? value.at(0)?.toString() : value?.toString();
}

function extractDomainFromQueryParam(req: Pick<WebRequest, "query">): string | undefined {
    const domainValue = queryParamAsString(req.query, "domain");
    return domainValue?.length ? domainValue : undefined;
}

export function getDomainFromRequest(
    req: Pick<WebRequest, "hostname" | "query">,
    application: Application | undefined,
    options?: { returnOnlySubdomain?: boolean },
): string {
    const domain = extractDomainFromApplicationRequest(req, application);
    if (!options?.returnOnlySubdomain) {
        return domain;
    }
    const suffixToRemove = application === Application.EDITOR || application === Application.READER ?
        ".manual.to" :
        ".binders.media";
    return domain.substring(0, domain.indexOf(suffixToRemove));
}

function extractDomainFromApplicationRequest(
    req: Pick<WebRequest, "hostname" | "query">,
    application: Application | undefined,
): string {
    if (isProduction()) {
        return application === Application.EDITOR ?
            req.hostname.replace(".editor.", ".") :
            req.hostname;  // covers the `undefined` case
    } else {
        return extractDomainFromQueryParam(req) ?? DEFAULT_DEV_DOMAIN
    }
}

export function getHostnameForRequest(req: WebRequest, application: Application): string {
    const proxiedReaderDomain = req.proxyConfig ? req.proxyConfig.readerDomain : undefined;
    const queryDomain = queryParamAsString(req.query, "domain");
    let domain: string;

    if (application === Application.EDITOR) {
        domain = isProduction() ?
            req.hostname :
            queryDomain || (isStaging() ? req.hostname.replace(/^api/, "editor") : DEV_EDITOR);
    }
    // TODO MT-4121 this includes READER, PARTNERS, DASHBOARD, undefined!
    else {
        domain = isProduction() ?
            (proxiedReaderDomain || req.hostname) :
            queryDomain || (isStaging() ? req.hostname.replace(/^api/, "manualto") : DEV_READER);
    }

    return domain;
}

// getAccountsForUser(userId)
// getDomainFiltersForAccounts
let clients = {
    account: undefined,
    routing: undefined,
    user: undefined
};

const getClients = async () => {
    if (!clients.account) {
        const config = BindersConfig.get();
        clients = {
            account: await BackendAccountServiceClient.fromConfig(config, "domain-proxy"),
            routing: await BackendRoutingServiceClient.fromConfig(config, "domain-proxy"),
            user: await BackendUserServiceClient.fromConfig(config, "domain-proxy")
        }
    }
    return clients;
}

const extractLoginFromBasicAuthorizationHeader = (request: WebRequest): string|undefined => {
    let authorization = request.header("Authorization");
    if (!authorization) {
        return undefined;
    }
    const matches = authorization.match(/"(.*)"/);
    if (matches) {
        authorization = matches[1];
    }
    const headerParts = authorization.split(" ");
    if (!headerParts || headerParts[0].toLowerCase() !== "basic") {
        return undefined;
    }
    const b64String = headerParts[1];
    const credentialsString = new Buffer(b64String, "base64").toString("ascii");
    const credentials = credentialsString.split(":");
    return credentials[0];
}

const domainCache: {[login: string]: string} = {};

const getDomainFromAuthorizationHeader = async (request, proxyConfigurations: IProxyConfig) => {
    const login = extractLoginFromBasicAuthorizationHeader(request);
    if (login === undefined) {
        return undefined;
    }
    if (login in domainCache) {
        return domainCache[login];
    }
    const { account, routing, user } = await getClients();
    const userObject = await user.getUserByLogin(login);
    const accounts = await account.getAccountsForUser(userObject.id);
    const domains = (await routing.getDomainFiltersForAccounts(accounts.map(a => a.id)))
        .map(domainFilter => domainFilter.domain);
    for (const domain in proxyConfigurations) {
        const proxiedReaderDomain = proxyConfigurations[domain].readerDomain;
        if (domains.indexOf(proxiedReaderDomain) > -1) {
            domainCache[login] = domain;
            return domain;
        }
    }
    return undefined;
}

export const getProxyConfig = async (
    request: WebRequest,
    proxyConfigurations: IProxyConfig,
): Promise<IProxyDomainConfigWithDomain> => {
    const domain =
        request.header("x-manualto-forwarded-host") ||
        (await getDomainFromAuthorizationHeader(request, proxyConfigurations)) ||
        request.header("x-forwarded-host") ||
        isDev() && `${request.header("origin")}`.replace(/^https?:\/\//, "") ||
        undefined;

    const proxyConfig = domain && proxyConfigurations[domain];
    if (!proxyConfig) {
        return undefined;
    }
    return {
        proxyDomain: domain,
        ...proxyConfig
    }
}

/**
 * Determines whether request is from a customer using a proxy
 *
 * Note: This function does not rely on the {@link WebRequest.proxyDomain} since those
 * values are not available before the middleware is executed, and in some cases like
 * regular services, we're not even setting it at all.
 */
export const isProxiedRequest = (request: Request, proxyConfig: IProxyConfig): boolean => {
    const domain = request.header("x-manualto-forwarded-host") || request.header("x-forwarded-host");
    return !!domain && !!proxyConfig[domain];
}

export function isCustomDevDomain(domain: string): boolean {
    if (!domain) {
        return false;
    } else if (isStaging() && domain.endsWith(".staging.binders.media")) {
        return true;
    } else if (isDev() && ["172.17.0.1", "localhost"].includes(domain)) {
        return true;
    }
    return false;
}

const STAGING_EDITOR_REGEX = /^editor-[0-9a-zA-Z-]+\.staging\.binders\.media$/;
export function isEditorLikeDomain(domain: string) {
    return isProduction() && domain === "editor.manual.to" || isStaging() && STAGING_EDITOR_REGEX.test(domain);
}

async function getDomainFilter(domain: string, routingServiceContract: RoutingServiceContract): Promise<DomainFilter | undefined> {
    try {
        return await routingServiceContract.getDomainFilterByDomain(domain);
    } catch (error) {
        if (isStaging() || isDev()) {
            return undefined;
        }
        throw error;
    }
}

export async function findAccountIdByUserIdAndDomain(
    userId: string,
    domain: string,
    routingServiceContract: RoutingServiceContract,
    accountServiceContract: AccountServiceContract,
): Promise<string> {
    const domainFilter = await getDomainFilter(domain, routingServiceContract);
    const anyDomainWillDo = isEditorLikeDomain(domain) || isDev() || !domainFilter;
    if (!anyDomainWillDo && (!domainFilter || !domainFilter.domain)) {
        throw new Error(`Unknown domain ${domain}`);
    }
    const userAccountIds = await accountServiceContract.getAccountIdsForUser(userId)
    if (anyDomainWillDo) {
        if (!userAccountIds.length) {
            throw new Error(`No account domain found for user ${userId} given domain ${domain}`);
        }
        return userAccountIds[0];
    }
    if (!userAccountIds.includes(domainFilter?.accountId)) {
        throw new Error(`Unauthorized domain userId=${userId} domain=${domain} accountId=${domainFilter.accountId}`);
    }
    return domainFilter?.accountId;
}
