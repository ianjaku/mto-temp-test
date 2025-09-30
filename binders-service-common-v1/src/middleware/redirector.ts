import * as HTTPStatusCode from "http-status-codes";
import { DomainRedirectConfig, DomainRedirectConfigs, DomainRedirectConfigsProvider } from "./config";
import { NextFunction, Response } from "express";
import {
    createCacheProviderErrorsCounter,
    incrementCacheProviderErrorsCounterByOne
} from "../monitoring/prometheus/cacheProviderErrors";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { READER_ROUTES_PREFIXES } from "@binders/client/lib/util/readerRoutes";
import { WebRequest } from "../middleware/request";
import { createCachedProvider } from "../util/cache";
import { getDomainFromRequest } from "../util/domains";
import { getEnvironmentName } from "@binders/client/lib/util/environment";

const EDITOR_EXTERNAL_PORT = 30006;
const READER_EXTERNAL_PORT = 30014;

export async function buildDomainRedirectorHandler(domainRedirectorConfigsProvider: DomainRedirectConfigsProvider, application: Application) {
    const domainRedirector = await createCachedDomainRedirector(domainRedirectorConfigsProvider, application);
    return async (req: WebRequest, res: Response, next: NextFunction) => {
        const { hostname, query } = req;
        const domain = getDomainFromRequest({ hostname, query }, application);
        try {
            const newUrl = await domainRedirector?.transformUrl(domain, req.hostname, req.originalUrl);
            if (newUrl) {
                req.logger.info(`Redirecting request to ${newUrl}`, "domain-redirector");
                return res.redirect(HTTPStatusCode.MOVED_TEMPORARILY, newUrl);
            }
        } catch (err) {
            req.logger.warn(`Failed to determine the redirect url for ${req.hostname}/${req.originalUrl}`, "domain-redirector", { err });
            return res.sendStatus(HTTPStatusCode.NOT_FOUND);
        }
        next();
    }
}

async function createCachedDomainRedirector(domainRedirectorConfigsProvider: DomainRedirectConfigsProvider, application: Application): Promise<DomainRedirector | undefined> {
    if (domainRedirectorConfigsProvider == null) {
        return undefined;
    }
    createCacheProviderErrorsCounter();
    const cacheProvider = await createCachedProvider(
        domainRedirectorConfigsProvider,
        (e) => {
            // eslint-disable-next-line no-console
            console.error("Failed to fetch value", e);
            incrementCacheProviderErrorsCounterByOne();
        }
    );
    return new DomainRedirector(cacheProvider, application, getEnvironmentName());
}

export class DomainRedirector {

    private readonly application: Application;
    private readonly configProvider: () => DomainRedirectConfigs;
    private readonly environmentName: string;

    constructor(domainRedirectorConfigsProvider: () => DomainRedirectConfigs, application: Application, environmentName: string) {
        if (![Application.EDITOR, Application.READER].includes(application)) {
            throw new Error(`Unsupported application ${application}. Must be reader or editor`);
        }
        this.application = application;
        this.configProvider = domainRedirectorConfigsProvider;
        this.environmentName = environmentName;
    }

    async transformUrl(domain: string, hostname: string, relativePath: string): Promise<string | undefined> {
        const config = this.configProvider();
        if (config == null || !Object.hasOwn(config, domain)) {
            return undefined;
        }
        const domainRedirectConfig = config[domain];
        this.validateTargetDomain(domainRedirectConfig.targetDomain, domain);

        const baseUrl = this.resolveNewBaseUrl(domainRedirectConfig, hostname);
        const currentUrl = new URL(relativePath, baseUrl);
        currentUrl.pathname = this.resolveNewUrlPath(domainRedirectConfig, currentUrl.pathname);

        if (currentUrl.searchParams.has("domain")) {
            currentUrl.searchParams.set("domain", domainRedirectConfig.targetDomain);
        }
        return currentUrl.toString();
    }

    private validateTargetDomain(targetDomain: string, currentDomain: string): void {
        if (!targetDomain?.endsWith(".manual.to")) {
            throw new Error(`Invalid target domain ${targetDomain}. We only allow manual.to ones`);
        }
        if (targetDomain === currentDomain) {
            throw new Error(`Target domain cannot be the same as the source one: ${targetDomain}`);
        }
    }

    private resolveNewBaseUrl(domainRedirectConfig: DomainRedirectConfig, hostname: string): string {
        if (this.environmentName === "production") {
            const targetDomain = domainRedirectConfig.targetDomain;
            const applicationUrl = this.application === Application.EDITOR ?
                targetDomain.replace(".manual.to", ".editor.manual.to") :
                targetDomain;
            return `https://${applicationUrl}/`;
        } else if (this.environmentName === "staging") {
            return `https://${hostname}`;
        } else {
            const port = this.application === Application.EDITOR ? EDITOR_EXTERNAL_PORT : READER_EXTERNAL_PORT;
            return `http://${hostname}:${port}`;
        }
    }

    private resolveNewUrlPath(domainRedirectConfig: DomainRedirectConfig, path: string): string {
        const pathParts = path.split("/").filter(p => p);
        const routePrefix = READER_ROUTES_PREFIXES.has(pathParts.at(0)) ? pathParts.shift() : undefined;

        const newPathParts: string[] = [];
        for (const pathPart of pathParts.reverse()) {
            const redirectRule = domainRedirectConfig.rules[pathPart];
            if (redirectRule == null) {
                newPathParts.unshift(pathPart);
            } else if (redirectRule.type === "move") {
                newPathParts.unshift(redirectRule.newParent, pathPart);
                break;
            } else if (redirectRule.type === "rename") {
                newPathParts.unshift(redirectRule.newName);
            } else {
                throw new Error(`Could not rename ${pathPart}. Unknown redirect rule: ${JSON.stringify(redirectRule)}`);
            }
        }
        if (routePrefix) {
            newPathParts.unshift(routePrefix);
        }
        return newPathParts.join("/");
    }
}
