import "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import * as fs from "fs";
import {
    AccountFeatures,
    FEATURE_ALLOW_IFRAMES,
    FEATURE_DISABLE_CONCURRENT_LOGINS,
    FEATURE_DISABLE_SIGNUP
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendRoutingServiceClient,
    BackendTrackingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    DomainRedirectConfigs,
    IProxyConfig,
    WebAppConfig
} from "@binders/binders-service-common/lib/middleware/config";
import { buildShouldBlockAccess, logUrlAccess } from "./access";
import {
    configureWebApp,
    startApp
} from "@binders/binders-service-common/lib/middleware/app";
import { cssHandler, getCustomFonts } from "./csshandler";
import {
    extractAccountDefaultLanguageFromRequest,
    extractInterfaceLanguageFromRequest
} from "@binders/binders-service-common/lib/util/i18n";
import {
    getAccountFeaturesFromRequestContext,
    getAccountIdFromRequestContext,
    getAccountSettingsFromRequestContext
} from "@binders/binders-service-common/lib/middleware/requestContext";
import googleFontHandlers, {
    getLocalGoogleFontEntry
} from "@binders/binders-service-common/lib/util/googlefonts";
import {
    impersonate,
    stopImpersonation
} from "@binders/binders-service-common/lib/middleware/impersonation";
import { inviteGet, invitePost, resendInvitePost } from "./invite";
import { resendResetPasswordPost, resetPasswordGet, resetPasswordPost } from "./reset";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { IBuildInfo } from "@binders/client/lib/clients/client";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import {
    PassportConfiguration
} from "@binders/binders-service-common/lib/authentication/middleware";
import { Router } from "express";
import { SAMLSSOConfig } from "@binders/binders-service-common/lib/authentication/saml-sso/config";
import { TokenVerifier } from "@binders/binders-service-common/lib/tokens";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { buildVerifyConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import { defaultReaderProps } from "@binders/binders-service-common/lib/style/reader";
import { getBuildInfo } from "@binders/binders-service-common/lib/sharedroutes/buildinfo";
import { getDomainFromRequest } from "@binders/binders-service-common/lib/util/domains";
import i18next from "@binders/client/lib/i18n";
import { isProduction } from "@binders/client/lib/util/environment";

const config = BindersConfig.get(60);
const logger = LoggerBuilder.fromConfig(config);
const verifyConfig = buildVerifyConfig(config);
const tokenVerifier = new TokenVerifier(verifyConfig);
const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
const SLEEP = 5000;

const getPublicDir = () => {
    return __dirname + "/../../public";
};

const {
    ASSETS,
    INVITE,
    RESET,
    STOPIMPERSONATION,
    RESEND_RESET,
    RESEND_INVITE
} = ManualToRoutes;

// tslint:disable:no-console
async function setup() {
    // Make sure index.html exists (webpack builds this in dev)
    while (!fs.existsSync(getPublicDir() + "/index.html")) {
        await sleep(SLEEP);
        // eslint-disable-next-line no-console
        console.log(`Could  not find index.html, retrying in ${SLEEP / 1000}s...`);
    }
}

const buildMessages = async (request: WebRequest) => {
    const interfaceLanguage = await extractInterfaceLanguageFromRequest(request);
    const t = (key) => i18next.t(key, { lng: interfaceLanguage });
    return {
        loginTitlePage: t(TranslationKeys.Login_PageTitle),
        or: t(TranslationKeys.General_Or).toUpperCase(),
        email: t(TranslationKeys.General_Email),
        password: t(TranslationKeys.General_Password),
        login: t(TranslationKeys.User_Login),
        forgotPassword: t(TranslationKeys.Login_ForgotPassword),
        signupMessage: t(TranslationKeys.Login_SignupMessage),
        ieWarning: t(TranslationKeys.General_DontUseIEWarning),
        gotIt: t(TranslationKeys.General_GotIt),
    }
}

Promise.all([
    BackendAccountServiceClient.fromConfig(config, "reader"),
    BackendRoutingServiceClient.fromConfig(config, "reader"),
    BackendTrackingServiceClient.fromConfig(config, "reader"),
    BackendUserServiceClient.fromConfig(config, "reader"),
    BackendCredentialServiceClient.fromConfig(config, "reader"),
    SAMLSSOConfig.fromConfig(config, "reader"),
]).then(async ([
    accountServiceClient,
    routingBackendClient,
    trackingServiceClient,
    userServiceClient,
    credentialServiceClient,
    samlSSOConfig,
]) => {
    await setup();
    const proxyConfig = config.getObject("proxy")
        .caseOf({
            just: (p) => p,
            nothing: () => ({})
        }) as IProxyConfig;


    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function extraSetup(router: Router, passportConfig: PassportConfiguration<string>) {
        router.get(`${ASSETS}/index.css`, cssHandler(config, "index.css"));
        router.get(`${ASSETS}/invite.css`, cssHandler(config, "invite.css"));
        router.get(`${ASSETS}/reset.css`, cssHandler(config, "reset.css"));
        router.get(`${ASSETS}/login.css`, cssHandler(config, "login.css"));
        // commented out temporarily, will be reenabled in MT-3999
        // router.get(`${ASSETS}/styles.css`, cssHandler(config, "styles.css"));
        router.get(`${INVITE}/:token`, inviteGet(tokenVerifier, userServiceClient, credentialServiceClient, proxyConfig, routingBackendClient));
        router.post(`${INVITE}/:token`, invitePost(tokenVerifier, userServiceClient, credentialServiceClient, routingBackendClient));
        router.post(`${RESEND_INVITE}`, resendInvitePost(userServiceClient));
        router.get(`${RESET}/:token`, resetPasswordGet(tokenVerifier, userServiceClient, proxyConfig, credentialServiceClient));
        router.post(`${RESET}/:token`, resetPasswordPost(tokenVerifier, userServiceClient, credentialServiceClient, routingBackendClient, accountServiceClient));
        router.post(`${RESEND_RESET}`, resendResetPasswordPost(userServiceClient));
        router.get(`${ASSETS}/googlefonts/:fontName`, googleFontHandlers.entry(logger));
        router.get(`${ASSETS}/googlefonts/*`, googleFontHandlers.proxy(logger, proxyConfig));
        router.get(`/:proxyPath*${ASSETS}/googlefonts/:fontName`, googleFontHandlers.entry(logger));
        router.get(`/:proxyPath*${ASSETS}/googlefonts/*`, googleFontHandlers.proxy(logger, proxyConfig));
        router.post("/impersonate", impersonate(config));
        router.get(STOPIMPERSONATION, stopImpersonation(credentialServiceClient));

        router.use(logUrlAccess(routingBackendClient, trackingServiceClient, { excludePrefixes: [ASSETS] }));
    }
    const requestValidation = buildShouldBlockAccess();

    const isSignupAllowed = async (accountId: string, accountFeatures: AccountFeatures) => {
        if (accountFeatures.includes(FEATURE_DISABLE_SIGNUP)) {
            return false;
        }
        const whiteListedEmails = accountId ?
            await userServiceClient.listWhitelistedEmails(accountId, { isActive: true }) :
            [];
        return !!whiteListedEmails.length;
    }

    const buildIndexTemplateVars = async (request: WebRequest) => {
        const domain = getDomainFromRequest(request, Application.READER, { returnOnlySubdomain: false });
        const buildInfoResult = await getBuildInfo();
        let buildInfo: IBuildInfo;
        if (buildInfoResult != null && typeof buildInfoResult === "object") {
            buildInfo = buildInfoResult.info;
        }
        const { userFont, titleFont, systemFont, systemFont2 } = defaultReaderProps;
        const defaultFontLinks = [
            userFont, titleFont, systemFont, systemFont2,
        ].map(fontName => getLocalGoogleFontEntry(fontName, request));

        try {
            const accountId = await getAccountIdFromRequestContext(domain, routingBackendClient);
            const branding = await routingBackendClient.getBrandingForReaderDomain(domain);
            const brandingVars = {
                ...branding,
                key: domain
            };
            const features = await getAccountFeaturesFromRequestContext(accountId, accountServiceClient);
            const customFontLinks = getCustomFonts(brandingVars.stylusOverrideProps, brandingVars.customFonts, request);
            const impersonation = request.cookies["impersonation"] || "{}";
            const showSignupLink = await isSignupAllowed(accountId, features);
            const browser = request["headers"] && request["headers"]["user-agent"];
            const isIE = /msie/i.test(browser);
            const accountSettings = await getAccountSettingsFromRequestContext(accountId, accountServiceClient);
            const templateVars = {
                brandingColor: brandingVars.stylusOverrideProps && brandingVars.stylusOverrideProps.bgDark,
                branding: JSON.stringify(brandingVars),
                brandingOverride: domain || "default",
                fontLinks: defaultFontLinks.concat(customFontLinks),
                impersonation: JSON.stringify(impersonation),
                buildInfo: JSON.stringify(buildInfo ?? null),
                showSignupLink,
                isIE,
                messages: (await buildMessages(request)),
                accountDefaultLanguageCode: await extractAccountDefaultLanguageFromRequest(request),
                htmlHeadContent: accountSettings?.htmlHeadContent,
            };
            return templateVars;
        } catch (error) {
            logger.logException(error, "middle-ware");
            const dummy = JSON.stringify({});
            return {
                brandingColor: dummy,
                htmlHeadContent: undefined,
                branding: dummy,
                impersonation: JSON.stringify(dummy),
                buildInfo: JSON.stringify(buildInfo ?? null),
                accountDefaultLanguageCode: "en",
                fontLinks: defaultFontLinks,
                messages: (await buildMessages(request)),
                isIE: false
            }
        }
    };
    const publicDir = getPublicDir();
    const allowIFrames = async (request) => {
        // Don't do an API call on the health checks they should always be lightweight
        // Also exclude the /assets path as it is used for static assets (saves 2 API calls per asset load)
        if (request.path.startsWith("/_status") || request.path.startsWith("/assets")) {
            return true;
        }
        try {
            const domain = getDomainFromRequest(request, Application.READER, { returnOnlySubdomain: false });
            const accountId = await getAccountIdFromRequestContext(domain, routingBackendClient);
            const features = await getAccountFeaturesFromRequestContext(accountId, accountServiceClient);
            if (features.includes(FEATURE_ALLOW_IFRAMES)) {
                return true;
            }
        } catch (error) {
            logger.error("Could not fetch account features.", "middle-ware", error);
        }
        return false;
    };


    const disableConcurrentLogins = async (request) => {
        if (request.path.startsWith("/_status")) {
            return false;
        }
        try {
            const domain = getDomainFromRequest(request, Application.READER, { returnOnlySubdomain: false });
            const accountId = await getAccountIdFromRequestContext(domain, routingBackendClient);
            const accountSettings = await getAccountFeaturesFromRequestContext(accountId, accountServiceClient);
            if (accountSettings.includes(FEATURE_DISABLE_CONCURRENT_LOGINS)) {
                return true;
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

    const appConfig: WebAppConfig = {
        appName: "reader-v1",
        application: Application.READER,
        indexFile: fs.realpathSync(`${publicDir}/index.html`),
        indexPath: "*",
        assetsDir: fs.realpathSync(publicDir),
        assetsPath: ASSETS,
        requestValidation,
        extraSetup,
        buildIndexTemplateVars,
        passportRouteConfigOverride: {
            loginTemplateFile: fs.realpathSync(`${publicDir}/login.html`),
            loginCssPath: `${ASSETS}/login.css`
        },
        samlSSOConfig,
        proxyConfig,
        allowIFrames,
        disableConcurrentLogins,
        domainRedirectorConfigsProvider,
    };
    const app = await configureWebApp(config, appConfig);
    startApp(app, 8014);
});
