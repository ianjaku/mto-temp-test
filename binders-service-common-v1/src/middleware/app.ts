/* eslint-disable @typescript-eslint/no-var-requires */
import * as HTTPStatusCode from "http-status-codes";
import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import * as ejs from "ejs";
import * as express from "express";
import * as fs from "fs";
import * as passport from "passport";
import { AppRoute, ErrorHandler } from "@binders/client/lib/clients/routes";
import {
    Authentication,
    buildFetchAccessTokenEndpoint,
    buildFetchAccessTokensEndpoint
} from "./authentication";
import {
    BackendAccountServiceClient,
    BackendRoutingServiceClient
} from "../apiclient/backendclient";
import { Config, ConfigError } from "@binders/client/lib/config/config";
import {
    DefaultAuthenticator,
    DefaultRequestInvitationHandler,
    DefaultUserSerializer,
    LoginHandler,
    PassportConfiguration,
    PassportRouteConfig,
    getApplicationFromAppname
} from "../authentication/middleware";
import {
    FEATURE_BROWSER_LOGO_FAVICON,
    FEATURE_USERTOKEN_LOGIN
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { IProxyConfig, WebAppConfig, buildClientConfig, resolveDomainFromRequest } from "./config";
import { Logger, LoggerBuilder, panicLog } from "../util/logging";
import { RateLimit, configureRouter, setupSharedRoutes } from "./routes";
import { WebRequest, finishRequestTimings, prepareRedirectUrl } from "./request";
import {
    getAccountFeaturesFromRequestContext,
    getAccountIdFromRequestContext,
    getAccountSettingsFromRequestContext
} from "./requestContext";
import {
    getCookieDomain,
    isDev,
    isProduction,
    isStaging
} from "@binders/client/lib/util/environment";
import { getDomainFromRequest, getProxyConfig } from "../util/domains";
import {
    hookInRequestLogger,
    logIncomingRequest,
    logLoginFailure,
    logLoginSuccess
} from "./logging";
import { Authorization } from "./authorization";
import { IBindersConfig } from "@binders/client/lib/clients/config";
import { ISAMLSSOConfig } from "../authentication/saml-sso/config";
import { Maybe } from "@binders/client/lib/monad";
import { Server } from "http";
import { SessionIdentifier } from "../authentication/identity";
import { TEN_YEARS } from "@binders/client/lib/util/time";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { UiErrorCode } from "@binders/client/lib/errors";
import { addK8sToApm } from "../monitoring/apm";
import { buildDomainRedirectorHandler } from "./redirector";
import { buildRequestBlockingRequestHandler } from "./block_requests";
import { buildSafeErrorResponse } from "./errorResponse";
import cors from "./cors";
import { createFatalErrorLogCounter } from "../monitoring/prometheus/fatalErrorMetric";
import { defaultErrorHandler } from "./errorHandler";
import { extractInterfaceLanguageFromRequest } from "../util/i18n";
import { getClientIpsAsString } from "../util/ip";
import { getRateLimiter } from "./rateLimiter";
import { helmetMiddleware } from "./helmet";
import { hookInJWTConfig } from "../tokens/jwt";
import i18next from "@binders/client/lib/i18n";
import { initializeRequestContext } from "./asyncLocalStorage";
import { isSafeForRedirect } from "../util/url";
import { isSilentSharedEndpoint } from "../sharedroutes";
import { kickoffMonitoring } from "../monitoring/prometheus";
import { minutesToMilliseconds } from "date-fns";
import { omit } from "ramda";
import { prefixGeneratedAssets } from "../util/dom";
import { setupRedirects } from "./redirect";
import { setupSAMLSSO } from "../authentication/saml-sso";
import { setupWhiteListing } from "../network/ipwhitelists";
import { syncIndices } from "../mongo/indices/helpers";
import { withParsedThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";

const expressSession = require("express-session");
const compression = require("compression");
const RedisStore = require("connect-redis")(expressSession);
const Redis = require("ioredis");

const hpp = require("hpp");

const MANUALTO_LOGIN_COOKIE = "manual-login";
// The value should represent the number of proxies in between the client and the server.
const PROXIES_NUMBER = 2;
const DEFAULT_SESSION_MAX_AGE = minutesToMilliseconds(15);

type SessionStore = {
    server: {
        useSentinel: boolean;
        sentinels: unknown;
        password?: string;
    };
}

function getRedisSessionStore(sessionStore: SessionStore, logger: Logger) {
    const server = sessionStore["server"];
    let storeOptions: Record<string, unknown> = {
        prefix: "xpr-sess-"
    };

    if (server.useSentinel) {
        const client = new Redis({
            sentinels: server.sentinels,
            name: "mymaster",
            updateSentinels: true,
            sentinelReconnectStrategy: () => 10000
        });
        client.on("error", (err: unknown) => {
            logger.error(`Redis connection error: ${err}`, "session-store")
        })
        storeOptions.client = client
    } else {
        storeOptions = {
            ...storeOptions,
            ...server
        };
    }
    if (server.password) {
        storeOptions["pass"] = server.password;
    }
    return new RedisStore(storeOptions);
}

function configureSessionStore(config: Config, sessionOptions: Record<string, unknown>) {
    const sessionStoreOption = config.getObject<SessionStore>("session.store");
    if (sessionStoreOption.isJust()) {
        const sessionStore = sessionStoreOption.get();
        switch (sessionStore["type"]) {
            case "memory":
                break;
            case "redis": {
                const logger = LoggerBuilder.fromConfig(config, "configureSessionStore");
                sessionOptions["store"] = getRedisSessionStore(sessionStore, logger);
                break;
            }
            default:
                throw new ConfigError(`Unknown store type: ${sessionStore["type"]}`);
        }
    }
    return sessionOptions;
}

export function getSessionMaxAge(config: Config): number {
    const sessionMaxAgeOption = config.getNumber("session.maxAge");
    return sessionMaxAgeOption.getOrElse(DEFAULT_SESSION_MAX_AGE);
}

function configureSessions(app: express.Application, config: Config, cookieDomain?: string) {
    const sessionSecretOption = config.getString("session.secret");
    if (sessionSecretOption.isNothing()) {
        throw new ConfigError("Could not determine session secret.");
    }
    const sessionMaxAge = getSessionMaxAge(config);
    const domain = cookieDomain ||
        config.getString("session.cookieDomain").getOrElse(undefined);

    let sessionOptions: Record<string, unknown> = {
        secret: sessionSecretOption.get(),
        resave: true,
        saveUninitialized: true,
        name: MANUALTO_LOGIN_COOKIE,
        proxy: true,
        cookie: {
            secure: !isDev(),
            // httpOnly: true,
            domain: domain,
            maxAge: sessionMaxAge,
            sameSite: isDev() ? "lax" : "none",
        },
        // rolling: false,
        genid: function() {
            return SessionIdentifier.generate().value();
        }
    };

    app.set("trust proxy", PROXIES_NUMBER);

    sessionOptions = configureSessionStore(config, sessionOptions);
    const realSessionHandler = expressSession(sessionOptions);
    const sessionHandler = async (request: WebRequest, response: express.Response, next: express.NextFunction) => {
        if (isSilentSharedEndpoint(request)) {
            next();
        } else {
            realSessionHandler(request, response, next);
        }
    }
    app.use(sessionHandler);

    // Make sure the session is available in all requests
    app.use(async function(req: WebRequest, _res, next) {
        if (!isSilentSharedEndpoint(req) && !req["session"]) {
            return next(new Error("Session store unavailable."));
        }
        next();
    });

    app.use(async (request: WebRequest, response, next) => {
        if (isSilentSharedEndpoint(request)) {
            next();
        } else {
            passport.session()(request, response, next);
        }
    })

}

export interface ServiceRoute<Request = WebRequest> extends AppRoute {
    serviceMethod?(
        validatedRequest: Request,
        response?: express.Response,
        next?: express.NextFunction
    ): Promise<unknown>;
    serviceHandler?(request: Request, response: express.Response, next?: express.NextFunction): Promise<unknown>;
    authentication?: Authentication;
    authorization?: Authorization;
    csvFormattingOrder?: (string | RegExp)[]; // The preferred order in which the headers should appear
    rateLimit?: RateLimit;
}

function compressionFilter(req: WebRequest, res: express.Response) {
    const contentTypes = res.getHeader("Content-Type");
    const contentType = Array.isArray(contentTypes) ? contentTypes.join(" ") : contentTypes?.toString();
    const isJson = /^application\/json/.test(contentType);
    if (isJson) {
        return true;
    }
    return compression.filter(req, res);
}

interface IExpressAppOptions {
    serviceName: string;
    samlSSOConfig: ISAMLSSOConfig;
    cookieDomain: string;
    installPreMiddleware: (app: express.Application) => void;
    proxyConfig: IProxyConfig;
    textContentTypeToJson: boolean;
    shouldLogCors: boolean;
    allowIFrames: (req: WebRequest) => Promise<boolean>;
    disableConcurrentLogins?: (req: WebRequest) => Promise<boolean>;
    hasSessions: boolean;
    /** Whether to use the rate limiter middleware, default is `undefined` */
    rateLimiterValue?: number;
}

function createAppOrApi(
    config: Config,
    options: Partial<IExpressAppOptions> = {}
): express.Application {
    const {
        allowIFrames,
        cookieDomain,
        installPreMiddleware,
        serviceName,
        textContentTypeToJson,
        proxyConfig,
        shouldLogCors,
        hasSessions,
        rateLimiterValue,
    } = options;
    kickoffMonitoring(serviceName || "n/a");
    const app = express();
    const rateLimiter = getRateLimiter(rateLimiterValue, config, serviceName || "N/A");
    if (rateLimiter != null) {
        app.use(rateLimiter);
    }
    app.use(hookInRequestLogger(config, serviceName || "default-create"));
    app.use(cookieParser());
    app.use(bodyParser.urlencoded({ extended: true }));
    const jsonContentTypes = ["application/json"];
    if (textContentTypeToJson) {
        jsonContentTypes.push("text/*");
    }
    app.use(bodyParser.json({ limit: "10mb", type: jsonContentTypes }));
    app.use(bodyParser.json({ limit: "10kb", type: ["application/csp-report"] }));

    app.set("trust proxy", PROXIES_NUMBER);

    if (hasSessions) {
        configureSessions(app, config, cookieDomain);
    }
    // configureSessions somehow messes up the async hooks
    // as a result the initializeRequestContext middleware needs to be called AFTER setting up the sessions
    app.use(initializeRequestContext);
    app.use(helmetMiddleware(config, { allowIFrames }));

    // Before router
    app.use(hpp());
    app.use(cors(proxyConfig, shouldLogCors));
    app.use(compression({
        level: 6,
        filter: compressionFilter,
    }));

    if (installPreMiddleware) {
        installPreMiddleware(app);
    }

    app.use(logIncomingRequest());
    app.use(setupRedirects());
    app.use(addK8sToApm())
    return app;
}

function hasWebsocketEndpoints(
    routes: Array<[string, string, { [routeName: string]: ServiceRoute }, ErrorHandler]>,
) {
    return routes.some(route => {
        const namedServiceRoutes = route[2];
        return Object.keys(namedServiceRoutes).some(routeName => (
            namedServiceRoutes[routeName].webSocket === true
        ));
    });
}

export type ApiConfig = {
    routes: Array<[string, string, { [routeName: string]: ServiceRoute }, ErrorHandler]>;
    config: Config;
    /** Default is `true` */
    installCatchAllRoute?: boolean;
    installPreMWare?: (app: express.Application) => void;
    /** Whether to use the rate limiter middleware, default is `undefined` */
    rateLimiterValue?: number;
}

export function configureApi({
    routes,
    config,
    installCatchAllRoute = true,
    installPreMWare = app => app,
    rateLimiterValue,
}: ApiConfig): express.Application {
    const maybeInstallWs = hasWebsocketEndpoints(routes) ?
        (app: express.Application) => require("express-ws")(app) :
        (app: express.Application) => app;
    // Take the service name from the first serviceEntry
    const serviceName = `${routes[0][0]}-${routes[0][1]}`;
    const shouldLogCors = process.env.BINDERS_SHOULD_LOG_CORS === "1";
    const app = createAppOrApi(
        config,
        {
            installPreMiddleware: (application) => {
                installPreMWare(application);
                maybeInstallWs(application);
            },
            textContentTypeToJson: true,
            serviceName,
            shouldLogCors,
            hasSessions: false,
            rateLimiterValue,
        }
    );

    // Routes
    routes.forEach(serviceEntry => {
        const [serviceName, serviceVersion, namedServiceRoutes, errorHandler] = serviceEntry;
        const configPrefixKey = Config.getServicePrefixKey(serviceName);
        const overrides = ["images", "public", "content", "comment"];
        const servicePrefixOption = overrides.includes(serviceName) ?
            Maybe.just(`/${serviceName}`) :
            config.getString(configPrefixKey);
        if (servicePrefixOption.isNothing()) {
            throw new ConfigError(`Could not determine route prefix for service ${serviceName}`);
        }
        const servicePrefix = servicePrefixOption.get() + "/" + serviceVersion;
        const router = express.Router();
        router.use(hookInJWTConfig(config));
        router.use(initializeRequestContext);
        const unnamedRoutes = Object.keys(namedServiceRoutes).reduce((accumulator, key) => {
            accumulator.push(namedServiceRoutes[key]);
            return accumulator;
        }, []);
        const returnValidationErrors = !isProduction() ||
            serviceName === "public" ||
            serviceName === "public-api";
        configureRouter(router, unnamedRoutes, errorHandler, config, returnValidationErrors);
        setupSharedRoutes(router);
        app.use(servicePrefix, router);
    });

    installPostMiddleware(app, installCatchAllRoute);

    // Error handler has to be the last middleware
    app.use(defaultErrorHandler);
    createFatalErrorLogCounter(serviceName)
    return app;
}

const cookieOptions = {
    [MANUALTO_LOGIN_COOKIE]: {
        httpOnly: true,
        domain: getCookieDomain(),
        secure: !isDev(),
    },

}
export const clearCookies = (request: WebRequest, response: express.Response, skipAcknowledge = false): string[] => {
    response.clearCookie(MANUALTO_LOGIN_COOKIE, { domain: "dev.binders.media" });
    response.clearCookie(MANUALTO_LOGIN_COOKIE, { domain: "binders.media" });
    const deleted = [];
    let foundLogin = false;
    for (const name in request.cookies) {
        if (name === "cookies-acknowledged" && skipAcknowledge) {
            continue;
        }
        const options = cookieOptions[name];
        foundLogin = foundLogin || name === MANUALTO_LOGIN_COOKIE;
        deleted.push(name);
        if (options) {
            response.clearCookie(name, options);
        } else {
            response.clearCookie(name);
        }
    }
    if (!foundLogin) {
        deleted.push(MANUALTO_LOGIN_COOKIE);
    }
    return deleted;
}

const handleProxyConfiguration = (proxyConfigurations: IProxyConfig) => {
    return async (req: WebRequest, _: express.Response, next: express.NextFunction) => {
        req.proxyConfig = await getProxyConfig(req, proxyConfigurations);
        next();
    };
};

export async function configureWebApp(config: Config, appConfig: WebAppConfig): Promise<express.Application> {
    const proxyConfigurations = appConfig.proxyConfig || {};
    const {
        samlSSOConfig,
        cookieDomain,
        appName: serviceName,
        allowIFrames,
        disableConcurrentLogins,
        application,
        domainRedirectorConfigsProvider,
    } = appConfig;
    const app = createAppOrApi(
        config,
        {
            samlSSOConfig,
            cookieDomain,
            proxyConfig: proxyConfigurations,
            serviceName,
            allowIFrames,
            disableConcurrentLogins,
            hasSessions: true
        }
    );
    setupWhiteListing(app, config);
    app.use(createBlockIE11Midleware());
    app.use(handleProxyConfiguration(proxyConfigurations));

    const accountServiceClientPromise = BackendAccountServiceClient.fromConfig(config, "index-handler");
    const routingServiceClientPromise = BackendRoutingServiceClient.fromConfig(config, "index-handler");

    app.use(buildRequestBlockingRequestHandler(
        config,
        {
            crossAccountHelpers: {
                application: appConfig.application,
                routingServiceClientPromise
            },
            assetsPath: appConfig.assetsPath,
        }
    ));

    if (samlSSOConfig) {
        setupSAMLSSO(app, samlSSOConfig, config);
    }

    if (domainRedirectorConfigsProvider) {
        app.use(await buildDomainRedirectorHandler(domainRedirectorConfigsProvider, application));
    }

    installPostMiddleware(app, false);

    const indexFileContents: string = fs.readFileSync(appConfig.indexFile, "utf8");
    const loginTemplateFile = (appConfig.passportRouteConfigOverride && appConfig.passportRouteConfigOverride.loginTemplateFile) ||
        fs.realpathSync(__dirname + "/../assets/login.html");

    const passportRouteConfigDefault: PassportRouteConfig = {
        homeRoute: "/",
        loginRoute: "/login",
        signupRoute: "/signup",
        logoutRoute: "/logout",
        loginTemplateFile,
        signupTemplateFile: fs.realpathSync(__dirname + "/../assets/signup.html")
    };
    const passportRouteConfig = appConfig.passportRouteConfigOverride ?
        Object.assign({}, passportRouteConfigDefault, appConfig.passportRouteConfigOverride) :
        passportRouteConfigDefault;

    const logLoginHandler: LoginHandler = {
        success: async (req, user) => {
            const application = getApplicationFromAppname(appConfig.appName);
            logLoginSuccess(user, getDomainFromRequest(req, application, { returnOnlySubdomain: false }), application);
        },
        failure: async (req, failureMessage) => {
            const { body: { username } } = req;
            const application = getApplicationFromAppname(appConfig.appName);
            logLoginFailure(username, getDomainFromRequest(req, application, { returnOnlySubdomain: false }), failureMessage, application);
        }
    };

    const passportConfig = new PassportConfiguration<string>(
        DefaultAuthenticator.get(),
        new DefaultUserSerializer(),
        passportRouteConfig,
        DefaultRequestInvitationHandler.get(),
        logLoginHandler,
        appConfig.samlSSOConfig
    );

    const blockAccess = (req: WebRequest, res: express.Response, next: express.NextFunction, reason: string) => {
        if (req.logger) {
            req.logger.error("Blocking access: " + reason, "access-control");
        }
        const blockAccessHandler = passportConfig.blockAccess(reason);
        blockAccessHandler(req, res, next);
    };

    const router = express.Router();
    // install shared routes here
    setupSharedRoutes(router);

    passportConfig.apply(app, router, appConfig);

    router.use((req: WebRequest, res, next) => {
        appConfig.requestValidation(passportConfig, req).then(
            rejectOption => {
                if (rejectOption.isJust()) {
                    if (req.session.redirectRoute === undefined || req.session.redirectRoute === "/") {
                        req.session.redirectRoute = req.originalUrl;
                    }
                    blockAccess(req, res, next, rejectOption.get());
                } else {
                    next();
                }
            },
            err => next(err)
        );
    });

    app.post("/auth/access-token", buildFetchAccessTokenEndpoint(config));
    app.post("/auth/access-tokens", buildFetchAccessTokensEndpoint(config));

    const doAuthenticationWithHeader = async (req: WebRequest): Promise<AuthenticationResult> => {
        const authorization = req.header("Authorization");
        const b64String = authorization && authorization.split(" ")[1];
        if (!authorization || !b64String) {
            return "noAuth";
        }
        const credentialsString = Buffer.from(b64String, "base64").toString("ascii");
        const credentials = credentialsString.split(":");
        const authenticatedSession = await passportConfig.authenticator.authenticate(credentials[0], credentials[1]);
        req.user = authenticatedSession;
        return "success";
    };

    type AuthenticationResult = "success" | "tokenExpired" | "noAuth" | "noToken" | "noUtFeature" | "unknownError";

    async function doAuthenticationWithUserToken(req: WebRequest): Promise<AuthenticationResult> {
        const { query: { ut }, headers } = req;
        try {
            const routingServiceClient = await routingServiceClientPromise;
            const domain = getDomainFromRequest(req, getApplicationFromAppname(appConfig.appName), { returnOnlySubdomain: false });
            const accountId = await getAccountIdFromRequestContext(domain, routingServiceClient);
            const authenticatedSession = await passportConfig.authenticator.authenticateWithUserToken(
                `${ut}`,
                accountId,
                headers["user-agent"],
                getClientIpsAsString(req),
            );
            req.user = authenticatedSession;
            return "success";
        } catch (e) {
            if (e.statusCode === HTTPStatusCode.UNAUTHORIZED && e?.errorDetails?.includes("expired")) {
                return "tokenExpired";
            }
            if (req.logger) {
                req.logger.error(e.message, "index-handler");
            }
            return "noAuth";
        }
    }

    async function tryAuthenticationWithUsertoken(
        req: WebRequest,
        featuresUserTokenLogin: boolean,
        res: express.Response,
        next: express.NextFunction,
    ): Promise<AuthenticationResult> {
        const { query: { ut } } = req;
        if (!ut) {
            return "noToken";
        }
        if (!featuresUserTokenLogin) {
            return "noUtFeature";
        }
        const utAuthenticationResult = await doAuthenticationWithUserToken(req);

        if (utAuthenticationResult === "success") {
            const domain = getDomainFromRequest(req, getApplicationFromAppname(serviceName), { returnOnlySubdomain: false });
            req.logIn(req.user, err => {
                if (err) {
                    return next(err);
                }
                const queryParams = isProduction() ? req.query : { domain: domain, ...req.query };
                const redirectURLCandidate = prepareRedirectUrl(req.path, omit(["ut"], queryParams));
                if (!redirectURLCandidate) {
                    res.redirect("/");
                } else if (isSafeForRedirect(redirectURLCandidate)) {
                    res.redirect(redirectURLCandidate);
                } else {
                    req.logger?.warn(`Unsafe redirect URL: ${redirectURLCandidate}`, "unsafe-redirect");
                    res.redirect("/");
                }
                return utAuthenticationResult;
            });
        }
        if (utAuthenticationResult !== "noAuth") {
            return utAuthenticationResult;
        }
        return "unknownError";
    }

    const indexHandler = async (req: WebRequest, res: express.Response, next: express.NextFunction, extraTemplateVars: Record<string, unknown>) => {
        const domain = resolveDomainFromRequest(appConfig, req)

        let userAccountIds: string[] = [];
        let domainAccountId: string;
        let featuresUserTokenLogin: boolean;
        let featuresBrowserLogoFavicon: boolean;

        try {
            const routingServiceClient = await routingServiceClientPromise;
            const accountServiceClient = await accountServiceClientPromise;
            domainAccountId = await getAccountIdFromRequestContext(domain, routingServiceClient);
            const accountFeatures = await getAccountFeaturesFromRequestContext(domainAccountId, accountServiceClient);
            featuresUserTokenLogin = accountFeatures.includes(FEATURE_USERTOKEN_LOGIN);
            featuresBrowserLogoFavicon = accountFeatures.includes(FEATURE_BROWSER_LOGO_FAVICON);
        } catch (err) {
            if (req.logger) {
                req.logger.error(err.message, "index-handler");
            }
        }

        const utAuthenticationResult = await tryAuthenticationWithUsertoken(req, featuresUserTokenLogin, res, next);
        if (utAuthenticationResult === "tokenExpired") {
            return res.redirect(`${passportRouteConfig.loginRoute}?reason=${UiErrorCode.tokenExpired}`)
        }
        if (utAuthenticationResult === "success") {
            return;
        }
        if (!req.user) {
            await doAuthenticationWithHeader(req);
        }

        let faviconUrl: string;
        if (featuresBrowserLogoFavicon) {
            try {
                const accountServiceClient = await accountServiceClientPromise;
                const accountSettings = await getAccountSettingsFromRequestContext(
                    domainAccountId,
                    accountServiceClient
                );
                const thumbnail = withParsedThumbnail(accountSettings)?.thumbnail
                faviconUrl = thumbnail?.buildRenderUrl({ requestedFormatNames: ["thumbnail"] });
            } catch (err) {
                if (req.logger) {
                    req.logger.error(err.message, "index-handler");
                }
            }
        }

        if (req.user) {
            try {
                const accountServiceClient = await accountServiceClientPromise;
                userAccountIds = await accountServiceClient.getAccountIdsForUser(req.user.userId)
                if (req.user.isDeviceUser) {
                    // to prevent device user sessions from expiring, renew their session cookie on every page load
                    res.cookie(MANUALTO_LOGIN_COOKIE, req.cookies[MANUALTO_LOGIN_COOKIE], {
                        secure: !isDev(),
                        domain: cookieDomain || config.getString("session.cookieDomain").getOrElse(undefined),
                        maxAge: TEN_YEARS,
                        sameSite: isDev() ? "lax" : "none",
                    });
                }
            } catch (err) {
                if (req.logger) {
                    req.logger.error(err.message, "index-handler");
                }
            }
        }

        let clientConfig: IBindersConfig;
        // The code below manages the API token
        // If we are accessing content of an account we do no not have access to
        // The default API token will not be set (i.e. calls will be made publicly)
        // However, we will set the externalUserToken so we can login and load the correct user details
        try {
            clientConfig = await buildClientConfig(
                appConfig,
                config,
                req,
                userAccountIds.includes(domainAccountId) ?
                    [domainAccountId] :
                    []
            )
        } catch (ex) {
            try {
                const interfaceLanguage = await extractInterfaceLanguageFromRequest(req);
                const failureMessage = i18next.t(TranslationKeys.General_SessionEnd, { lng: interfaceLanguage });
                if (ex.statusCode === 404 && ex.errorDetails === failureMessage) {
                    res.redirect(`${passportRouteConfig.logoutRoute}?reason=${UiErrorCode.sessionEnd}`);
                    return;
                } else {
                    next(ex);
                }
            } catch (error) {
                next(error)
            }
            return;
        }

        const sendIndexFile = () => {
            let contents = isProduction() ?
                indexFileContents :
                fs.readFileSync(appConfig.indexFile, "utf8");

            if (isStaging() || isDev()) {
                if (isStaging()) {
                    clientConfig.isStaging = true;
                }
                contents = contents.replace(
                    /<link href="\/assets\/(.*)\.css" rel="stylesheet">/,
                    `<link href="/assets/$1.css?domain=${domain}" rel="stylesheet">`
                )
            }

            if (req.proxyConfig) {
                contents = prefixGeneratedAssets(contents, clientConfig.pathPrefix);
            }

            const templateData = Object.assign({
                config: JSON.stringify(clientConfig),
                proxyPath: clientConfig.pathPrefix,
                faviconUrl
            }, extraTemplateVars);
            const str = ejs.render(contents, templateData, {});
            const statusCode = 200;
            res.set("Pragma", "no-cache");
            res.set("Cache-Control", "no-cache,no-store");
            res.send(str);
            res.end();
            finishRequestTimings(req);
            if (req.logger) {
                req.logger.info(
                    "Request finished",
                    "request",
                    {
                        url: req.url,
                        method: req.method,
                        status: statusCode,
                        timings: req.timings
                    }
                );
            }
        };

        if (req.user && appConfig.backendSignConfig && !clientConfig.backendToken) {
            next(new Error("Could not resolve backend token"));
            return;
        }

        if (req.user && !clientConfig.api.token) {
            next(new Error("Could not resolve API token"));
            return;
        }

        try {
            sendIndexFile();
        } catch (error) {
            req.logger?.logException(error, "index-handler");
            res.set("Pragma", "no-cache");
            res.set("Cache-Control", "no-cache,no-store");
            res.status(500).send(buildSafeErrorResponse());
            res.end();
        }
    };

    const staticPath = appConfig.assetsPath ? appConfig.assetsPath : "/";
    const indexPath = appConfig.indexPath ? appConfig.indexPath : "/";
    if (appConfig.extraSetup) {
        appConfig.extraSetup(router, passportConfig);
    }

    const indexHandlerWithTemplateVars = (
        request: WebRequest,
        response: express.Response,
        next: express.NextFunction
    ) => {
        const templateVarsPromise = appConfig.buildIndexTemplateVars ?
            appConfig.buildIndexTemplateVars(request) :
            Promise.resolve({});
        templateVarsPromise
            .then(extraVars => {
                indexHandler(request, response, next, extraVars);
            })
            .catch(error => next(error));
    };

    const clearCookiesHandler = async (request: WebRequest, response: express.Response) => {
        const deleted = clearCookies(request, response)
        request.logout(() => {
            const message = `
                <div>
                    The following cookies were deleted:
                    <ul>
                        ${deleted.map(item => `<li>${item}</li>`).join("")}
                    </ul>
                    <a href="/">Click here to go back</a>
                </div>
            `;
            response.send(message);
            response.send();
        });
    };

    router.get("/clear-cookies", clearCookiesHandler);

    if (indexPath === "*") {
        router.use("/favicon.ico", express.static(appConfig.assetsDir + "/favicon.ico"));
        if (!appConfig.skipServingStaticAssets) {
            router.use(staticPath, express.static(appConfig.assetsDir));
        }
        router.get(indexPath, appConfig.createIndexHandler ?
            await appConfig.createIndexHandler(app, appConfig) :
            indexHandlerWithTemplateVars,
        );
    } else {
        router.get(indexPath, appConfig.createIndexHandler ?
            await appConfig.createIndexHandler(app, appConfig) :
            indexHandlerWithTemplateVars,
        );
        if (!appConfig.skipServingStaticAssets) {
            router.use(staticPath, express.static(appConfig.assetsDir));
        }
    }

    app.use(router);

    // Error handler has to be the last middleware
    app.use(defaultErrorHandler);

    return app;
}

function installPostMiddleware(app: express.Application, installCatchAllRoute: boolean) {

    app.get("/robots.txt", (_request: WebRequest, response: express.Response) => {
        response.status(HTTPStatusCode.OK);
        response.type("text/plain");
        response.send("User-agent: *\r\nDisallow: /");
    });

    if (installCatchAllRoute) {
        // After routes
        app.use("*", function(req: WebRequest, res: express.Response) {
            if (!res.headersSent) {
                req.logger.error(
                    "Resource not found.",
                    "request",
                    {
                        url: req.originalUrl,
                        method: req.method
                    }
                );
                res.status(HTTPStatusCode.NOT_FOUND);
                res.send(JSON.stringify({ error: "We cannot find what you are looking for." }));
            }
        });
    }
}

export function getPort(): number {
    return process.env.BINDERS_SERVICE_PORT && parseInt(process.env.BINDERS_SERVICE_PORT, 10);
}

const shutdownHandler = (server: Server) => {
    return (signal: NodeJS.Signals) => {
        panicLog(`Closing server (${signal})...`);
        server.close((err) => {
            if (err) {
                panicLog("Error during shutdown.");
                panicLog(err);
                // eslint-disable-next-line no-console
                console.error(err);
                process.exit(1);
            } else {
                panicLog("Clean process exit...");
                process.exit(0);
            }
        })
    }
}

const setupProcessEventsListeners = (server: Server) => {
    process.on("SIGINT", shutdownHandler(server));
    process.on("SIGTERM", shutdownHandler(server));
    process.on("unhandledRejection", (error: unknown, promise: Promise<unknown>) => {
        panicLog("unhandledRejection");
        panicLog(error);
        panicLog(promise);
    });
    process.on("unhandledException", (error: unknown) => {
        panicLog("unhandledException");
        panicLog(error);
    });

}

function createBlockIE11Midleware() {
    return (req: WebRequest, res: express.Response, next: express.NextFunction) => {
        const userAgent = req.get("User-Agent")?.toLowerCase();
        if (userAgent == null) return next();
        if (
            userAgent.includes("msie") || // IE10 or older
            userAgent.includes("trident") // IE11
        ) {
            return res.send(`
                Dear user, <br/>
                <br />
                On June 15th, 2022, Microsoft retired internet explorer 11. <br />
                Henceforth, we, too, will no longer be supporting internet explorer. <br />
                <br />
                If internet explorer 11 support is vital to your operations, <br />
                please contact us at <a href="mailto:support@manual.to">support@manual.to</a> <br />
                <br />
                Sincerely, <br />
                The Manual.to team <br />
            `)
        }
        next();
    };
}

export function startApp(app: express.Application, defaultPort: number, host = "0.0.0.0"): void {
    const port = getPort() || defaultPort;
    const apiServer = app.listen(port, host, () => {
        const addr = apiServer.address();
        if (typeof addr === "string") {
            // eslint-disable-next-line no-console
            console.log("HTTP Server listening on %s", addr);
        } else {
            // eslint-disable-next-line no-console
            console.log("HTTP Server listening on %s:%s", addr.address, addr.port);
        }
        // Bump the timeout for keep alive connections to 1 minute (used by our ingress controller)
        // Default value is 5 seconds which might be the cause of the intermittent 502 errors in the pipeline
        apiServer.keepAliveTimeout = 60_000;
    });
    setupProcessEventsListeners(apiServer);
    if (isStaging()) {
        syncIndices();
    }
}
