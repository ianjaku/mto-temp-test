import * as urllib from "url";
import { isDev, isProduction, isStaging } from "@binders/client/lib/util/environment";
import { ParsedUrlQuery } from "querystring";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { withProtocol } from "@binders/client/lib/util/uri";

export function parseQueryString(url: string): ParsedUrlQuery {
    const parsedUrl = urllib.parse(url, true);
    return parsedUrl.query;
}

function isValidStorageAccountHost(hostname: string): boolean {
    // Could be refined to a more specific check
    return hostname.endsWith("core.windows.net");
}

function isValidLocalDevHost(hostname: string): boolean {
    return hostname.startsWith("localhost");
}

function isValidProductionHost(hostname: string): boolean {
    return hostname === "manual.to" || hostname.endsWith(".manual.to");
}

function isValidStagingHost(hostname: string): boolean {
    return hostname.endsWith("staging.binders.media");
}

export function isSafeForRedirect(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        if (isDev()) {
            return isValidLocalDevHost(hostname) || isValidStorageAccountHost(hostname);
        }
        if (isStaging()) {
            return isValidStagingHost(hostname) || isValidStorageAccountHost(hostname);
        }
        if (isProduction()) {
            return isValidProductionHost(hostname) || isValidStorageAccountHost(hostname);
        }
    } catch (e) {
        // URL is most likely a relative URL
        // Final check to see if starts with "//" which might redirect to a different domain
        return !url.startsWith("//");
    }

    throw new Error("Unknown environment");
}

export async function getReaderLocationForAccount(
    routingClient: RoutingServiceContract,
    accountId: string,
    path = "",
): Promise<string> {
    if (path && !path.startsWith("/")) {
        path = `/${path}`;
    }
    const [domainFilter] = await routingClient.getDomainFiltersForAccounts([accountId]);
    if (!domainFilter) {
        throw new Error(`No domain filters found for account ${accountId}`);
    }
    const url = isDev() ?
        `${withProtocol("localhost:30014")}${path}` :
        withProtocol(`${domainFilter.domain}${path}`, { forceHttps: true });
    const parsedUrl = new URL(url);
    if (isDev()) {
        parsedUrl.searchParams.set("domain", domainFilter.domain);
    }
    return parsedUrl.toString();
}

export async function getEditorLocationForAccount(
    routingClient: RoutingServiceContract,
    accountId: string,
): Promise<string> {
    const filters = await routingClient.getDomainFiltersForAccounts([accountId]);
    if (!filters?.length) {
        throw new Error(`No domain filters found for account ${accountId}`);
    }
    const domain = filters[0].domain;
    return withProtocol(domain.replace(".manual.to", ".editor.manual.to"));
}


// appends the path, preserving any existing path or query parameters on the baseUrl
export function injectPath(baseUrl: string, path: string): string {
    const url = new URL(baseUrl);
    if (path.startsWith("/")) {
        url.pathname = path;
    } else {
        if (!url.pathname.endsWith("/")) {
            url.pathname += "/";
        }
        url.pathname += path;
    }
    return url.toString();
}
