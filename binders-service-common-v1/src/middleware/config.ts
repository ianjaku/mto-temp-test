/* eslint-disable no-console */
import * as express from "express";
import {
    BackendSession,
    fetchAccessTokenWithSession
} from "./authentication";
import { JWTSignConfig, signJWT } from "../tokens/jwt";
import { PassportConfiguration, PassportRouteConfig } from "../authentication/middleware";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";
import { IBindersConfig } from "@binders/client/lib/clients/config";
import { ISAMLSSOConfig } from "../authentication/saml-sso/config";
import { Maybe } from "@binders/client/lib/monad/maybe";
import { RequestHandler } from "express";
import { UiErrorCode } from "@binders/client/lib/errors";
import { WebRequest } from "./request";
import { calculateIntercomUserHash } from "../intercom/hash";
import { getApplicationFromAppname } from "../authentication/middleware";
import { getDomainFromRequest } from "../util/domains";
import { isProduction } from "@binders/client/lib/util/environment";

export interface MovedItemRule {
    type: "move";
    newParent: string;
}

export interface RenamedItemRule {
    type: "rename";
    newName: string;
}

export interface DomainRedirectConfig {
    targetDomain: string;
    rules: Record<string, MovedItemRule | RenamedItemRule>
}

export type DomainRedirectConfigs = Record<string, DomainRedirectConfig>;
export type DomainRedirectConfigsProvider = () => Promise<DomainRedirectConfigs>;

export interface WebAppConfig {
    allowIFrames?: (req: WebRequest) => Promise<boolean>;
    appName: string;
    application: Application;
    assetsDir: string;
    assetsPath: string;
    backendSignConfig?: JWTSignConfig;
    buildIndexTemplateVars?(request: WebRequest): Promise<Record<string, unknown>>;
    cookieDomain?: string;
    disableConcurrentLogins?: (req: WebRequest) => Promise<boolean>;
    extraSetup?(router: express.Router, passportConfig: PassportConfiguration<string>): void;
    indexFile: string;
    indexPath?: string;
    passportRouteConfigOverride?: Partial<PassportRouteConfig>;
    proxyConfig?: IProxyConfig;
    requestValidation(passportConfig: PassportConfiguration<string>, req: WebRequest): Promise<Maybe<UiErrorCode>>;
    samlSSOConfig?: ISAMLSSOConfig;
    /**
    * if provided, will install custom index router instead of the default one serving EJS template
    */
    createIndexHandler?: (app: express.Application, appConfig: WebAppConfig) => Promise<RequestHandler>;
    /**
     * When set to true, will not serve static assets from `assetsDir` to `assetsPath`
     */
    skipServingStaticAssets?: boolean;
    domainRedirectorConfigsProvider?: DomainRedirectConfigsProvider;
}

export interface IProxyDomainConfigWithDomain extends IProxyDomainConfig {
    proxyDomain: string;
}

export interface IProxyDomainConfig {
    apiPath: string;
    protocol: string;
    readerDomain: string;
    readerPath: string;
}

export interface IProxyConfig {
    [domain: string]: IProxyDomainConfig;
}

export async function buildClientConfig(
    appConfig: WebAppConfig,
    config: Config,
    req: Pick<WebRequest, "hostname" | "proxyConfig" | "query" | "user">,
    userAccessableAccountIds: string[],
): Promise<IBindersConfig> {
    const { proxyConfig, user } = req;

    const serviceLocations = getServiceLocations(config, { proxyConfig });

    let backendToken: string | undefined = undefined;
    if (user && appConfig.backendSignConfig) {
        const backendSession = new BackendSession(user.userId, user.sessionId, user.accountIds);
        try {
            const token = await signJWT(backendSession, appConfig.backendSignConfig)
            backendToken = token;
        } catch (err) {
            console.error("Failed to sign backend token");
            throw err;
        }
    }

    const domain = resolveDomainFromRequest(appConfig, req);

    const token = user ? await fetchAccessTokenWithSession(config, user) : undefined;

    let intercomAppId = "";
    let intercomHash = "";
    const intercomConfigOption = config.getObject("intercom");
    if (isProduction() && intercomConfigOption.isJust()) {
        const intercomConfig = intercomConfigOption.get();
        intercomAppId = intercomConfig["appId"] || "";
        if (user) {
            const intercomSecret = intercomConfig["secretKey"];
            intercomHash = await calculateIntercomUserHash(user.userId, intercomSecret);
        }
    }

    const analyticsKey = config.getObject("bitmovin").caseOf({
        nothing: () => undefined,
        just: cfg => cfg["analyticsKey"] as string,
    })
    const bitmovin = analyticsKey ? { analyticsKey } : undefined;

    const isExternalUser =
        appConfig.appName.startsWith("reader") ?
            userAccessableAccountIds.length === 0 :
            false;

    const transactableOffersConfig = config.getObject("msTransactableOffers")
    let azureSSOAppID = "";
    let azureSSORedirectURI = "";
    let azureSSOAuthority = "";
    if (transactableOffersConfig.isJust()) {
        const msConfig = transactableOffersConfig.get();
        azureSSOAppID = msConfig["azureSSOAppID"] ?? "";
        azureSSORedirectURI = msConfig["azureSSORedirectURI"] ?? "";
        azureSSOAuthority = msConfig["azureSSOAuthority"] ?? "";
    }

    const [pathPrefix, proxiedReaderPath, proxiedAPiPath] = (proxyConfig) ?
        [
            proxyConfig.readerPath,
            `${proxyConfig.protocol}://${proxyConfig.proxyDomain}${proxyConfig.readerPath}`,
            `${proxyConfig.protocol}://${proxyConfig.proxyDomain}${proxyConfig.apiPath}`,
        ] :
        ["", "", ""];


    return {
        api: {
            token,
            locations: serviceLocations
        },
        backendToken,
        bitmovin,
        domain,
        intercom: {
            appId: intercomAppId,
            userHash: intercomHash,
        },
        hubspot: {
            portalId: config.getString("hubspot.portalId").getOrElse(""),
        },
        isExternalUser,
        msTransactableOffers: {
            azureSSOAppID,
            azureSSORedirectURI,
            azureSSOAuthority,
        },
        pathPrefix,
        proxiedAPiPath,
        proxiedReaderPath,
    };
}

// TODO MT-4121 use getDomainFromRequest or getHostnameForRequest instead?
export function resolveDomainFromRequest(
    appConfig: WebAppConfig,
    req: Pick<WebRequest, "hostname" | "query">,
): string {
    const { hostname, query } = req;
    if (isProduction()) {
        return hostname;
    } else {
        return getDomainFromRequest(
            { hostname, query },
            getApplicationFromAppname(appConfig.appName),
            { returnOnlySubdomain: false },
        );
    }
}

function getServiceLocations(
    config: Config,
    req: Pick<WebRequest, "proxyConfig">,
): { [serviceName: string]: string } {
    const services = config.getObject<Record<string, { externalLocation: string }>>("services").getOrElse({});
    const proxiedServiceLocation = req.proxyConfig ?
        `${req.proxyConfig.protocol}://${req.proxyConfig.proxyDomain}${req.proxyConfig.apiPath}` :
        undefined;

    const serviceLocations = {};
    for (const serviceName in services) {
        const serviceLocation = services[serviceName].externalLocation;
        serviceLocations[serviceName] = proxiedServiceLocation ?? serviceLocation;
    }
    return serviceLocations;
}
