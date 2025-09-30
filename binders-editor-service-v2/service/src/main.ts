import "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import * as fs from "fs";
import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { DomainRedirectConfigs, IProxyConfig, WebAppConfig } from "@binders/binders-service-common/lib/middleware/config";
import {
    configureViteDev,
    configureViteProd,
    configureWebpack,
} from "@binders/binders-service-common/lib/middleware/vite";
import { getPort, startApp } from "@binders/binders-service-common/lib/middleware/app";
import {
    impersonate,
    stopImpersonation
} from "@binders/binders-service-common/lib/middleware/impersonation";
import { resendResetPasswordPost, resetPasswordGet, resetPasswordPost } from "./reset";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { AuthorizationServiceContract } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Application as ExpressApplication } from "express";
import {
    FEATURE_DISABLE_CONCURRENT_LOGINS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly/flags";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Router } from "express";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { SAMLSSOConfig } from "@binders/binders-service-common/lib/authentication/saml-sso/config";
import { TokenVerifier } from "@binders/binders-service-common/lib/tokens";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { buildVerifyConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import { cssHandler } from "./csshandler";
import { getBuildInfo } from "@binders/binders-service-common/lib/sharedroutes/buildinfo";
import { getDomainFromRequest } from "@binders/binders-service-common/lib/util/domains";
import googleFontHandlers from "@binders/binders-service-common/lib/util/googlefonts";
import { isProduction } from "@binders/client/lib/util/environment";
import { join } from "path";
import { requestValidation } from "./access";

const config = BindersConfig.get(60);
const logger = LoggerBuilder.fromConfig(config);
const PORT = getPort() || 8006;

async function start() {
    const config = BindersConfig.get();
    let app: ExpressApplication;

    const isViteProd = process.argv.includes("--vite-prod")
    const isViteDev = process.argv.includes("--vite-dev")

    const clientSrcDir = fs.realpathSync(__dirname + "/../../../client");
    const indexFile = fs.realpathSync(join(clientSrcDir, "/vite/index.html"));
    const publicDir = isViteProd || isViteDev ?
        fs.realpathSync(join(clientSrcDir, "public")) :
        fs.realpathSync(__dirname + "/../../public");

    const isVite = isViteProd || isViteDev;

    const webAppDef = await createWebAppConfig(config, {
        assetsDir: publicDir,
        assetsPath: "/assets/",
        indexFile,
        indexPath: "*",
        isVite,
    });

    if (isViteProd) {
        app = await configureViteProd(config, webAppDef, {
            clientDistPath: fs.realpathSync(__dirname + "/../www"),
        });
    } else if (isViteDev) {
        app = await configureViteDev(config, webAppDef, {
            clientSrcDir: fs.realpathSync(__dirname + "/../../../client"),
            hmrConfig: {
                hmrHost: "0.0.0.0",
                hmrPort: 8096,
                hmrClientPort: 30096,
            },
        });
    } else {
        app = await configureWebpack(config, webAppDef, {
            publicDir: __dirname + "/../../public",
        });
    }
    startApp(app, PORT);
}

async function createWebAppConfig(
    config: BindersConfig,
    options: {
        assetsDir: string;
        assetsPath: string;
        indexFile: string;
        indexPath: string;
        isVite: boolean;
    },
): Promise<WebAppConfig> {
    const [
        accountServiceClient,
        azClient,
        userServiceClient,
        routingBackendClient,
        credentialServiceClient,
        samlSSOConfig,
    ] = await Promise.all([
        BackendAccountServiceClient.fromConfig(config, "editor"),
        BackendAuthorizationServiceClient.fromConfig(config, "editor"),
        BackendUserServiceClient.fromConfig(config, "editor"),
        BackendRoutingServiceClient.fromConfig(config, "editor"),
        BackendCredentialServiceClient.fromConfig(config, "editor"),
        SAMLSSOConfig.fromConfig(config, "editor"),
    ]);
    const assetsPath = options.assetsPath;

    const verifyConfig = buildVerifyConfig(config);
    const tokenVerifier = new TokenVerifier(verifyConfig);

    const proxyConfig = config.getObject("proxy")
        .caseOf({
            just: (p) => p,
            nothing: () => ({})
        }) as IProxyConfig;

    function extraSetup(router: Router) {
        router.get(`${assetsPath}index.css`, cssHandler(__dirname + "/../../public/" + "index.css"));
        router.get(`${assetsPath}login.css`, cssHandler(__dirname + "/../../public/" + "login.css"));
        router.get(`${assetsPath}styles.css`, cssHandler(__dirname + "/../../public/" + "styles.css"));
        router.get(`${assetsPath}googlefonts/:fontName`, googleFontHandlers.entry(logger));
        router.get(`${assetsPath}googlefonts/*`, googleFontHandlers.proxy(logger, proxyConfig));
        router.get(`/:proxyPath*${assetsPath}googlefonts/:fontName`, googleFontHandlers.entry(logger));
        router.get(`/:proxyPath*${assetsPath}googlefonts/*`, googleFontHandlers.proxy(logger, proxyConfig));
        router.get("/reset/:token", resetPasswordGet(tokenVerifier, userServiceClient, credentialServiceClient));
        router.post("/reset/:token", resetPasswordPost(tokenVerifier, userServiceClient, credentialServiceClient, routingBackendClient, accountServiceClient));
        router.post("/impersonate", impersonate(config));
        router.get("/stopimpersonation", stopImpersonation(credentialServiceClient));
        router.post("/reset-resend", resendResetPasswordPost(userServiceClient));
    }

    const disableConcurrentLogins = async (request: WebRequest) => {
        if (request.path.startsWith("/_status")) {
            return false;
        }
        try {
            const domain = getDomainFromRequest(request, Application.EDITOR, { returnOnlySubdomain: false });
            const accountIds = await routingBackendClient.getAccountIdsForDomain(domain);
            for (const accountId of accountIds) {
                const accountSettings = await accountServiceClient.getAccountFeatures(accountId);
                if (accountSettings.includes(FEATURE_DISABLE_CONCURRENT_LOGINS)) {
                    return true;
                }
            }
        } catch (error) {
            logger.error("Could not fetch account features.", "middle-ware", error);
        }
        return false;
    };

    let domainRedirectorConfigsProvider = undefined;
    if (!isProduction()) {
        const launchDarkly = await LaunchDarklyService.create(config, logger);
        domainRedirectorConfigsProvider = async () =>
            launchDarkly.getFlag<DomainRedirectConfigs>(LDFlags.DOMAIN_REDIRECT_CONFIGS);
    }

    return {
        appName: "editor-v2",
        application: Application.EDITOR,
        indexFile: options.indexFile,
        indexPath: options.indexPath,
        assetsDir: options.assetsDir,
        assetsPath,
        extraSetup,
        requestValidation: requestValidation(assetsPath, azClient),
        buildIndexTemplateVars: (request) => buildIndexTemplateVars(
            request,
            routingBackendClient,
            azClient
        ),
        passportRouteConfigOverride: {
            // Vite uses async loaded login page
            loginTemplateFile: options.isVite ?
                null :
                fs.realpathSync(`${__dirname}/../../public/login.html`),
        },
        samlSSOConfig,
        disableConcurrentLogins,
        domainRedirectorConfigsProvider,
    };
}

async function getAccountIdForSharedEditorDomain(
    authorizationClient: AuthorizationServiceContract,
    userId: string) {
    if (!userId) {
        return undefined;
    }
    try {
        const accounts = await authorizationClient.getAccountsForEditor(userId);
        return accounts?.[0]?.accountId;
    } catch (error) {
        logger.logException(error, "fetch-account-id-for-shared-editor-domain");
        return undefined;
    }
}

const buildIndexTemplateVars = async (
    request: WebRequest,
    routingClient: RoutingServiceContract,
    authorizationClient: AuthorizationServiceContract
) => {
    const buildInfoResult = await getBuildInfo();
    const buildInfo = typeof buildInfoResult === "object" ? buildInfoResult.info : {};

    const domain = getDomainFromRequest(request, Application.EDITOR, { returnOnlySubdomain: false });
    try {
        const accountId = (domain !== "editor.manual.to") ?
            (await routingClient.getAccountIdsForDomain(domain))[0] :
            await getAccountIdForSharedEditorDomain(authorizationClient, request.user?.userId);
        request.logger?.trace(`Querying LD flags for account: ${accountId} and user: ${request.user?.userId} (domain ${domain})`, "ld-flags");

    } catch (error) {
        request.logger?.error(`Unexpected error when resolving LaunchDarkly flags: ${error.message}`, "ld-flags");
    }
    const impersonation = request.cookies["impersonation"] || "{}";
    return {
        impersonation: JSON.stringify(impersonation),
        buildInfo: JSON.stringify(buildInfo),
    };
};

// eslint-disable-next-line no-console
start().catch(console.log)
