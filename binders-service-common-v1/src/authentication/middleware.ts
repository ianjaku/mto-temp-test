import * as ejs from "ejs";
import * as fs from "fs";
import * as passport from "passport";
import {
    Application,
    EventPayload,
    EventType,
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    FEATURE_INTERFACE_I18N,
    SAMLSSOMode,
    defaultSAMLSSOSettings,
    resolveSSOProviderName
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { NextFunction, RequestHandler, Response, Router } from "express";
import {
    NotificationServiceContract,
    RoutingKeyType,
    ServiceNotificationType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { RedisSessionRepository, SessionRepository } from "./sessionrepository";
import { UiErrorCode, translateUiErrorCode } from "@binders/client/lib/errors";
import { clearCookies, getSessionMaxAge } from "../middleware/app";
import {
    getAccountFeaturesFromRequestContext,
    getAccountIdFromRequestContext
} from "../middleware/requestContext";
import { isDev, isStaging } from "@binders/client/lib/util/environment";
import { isSafeForRedirect, parseQueryString } from "../util/url";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import { BindersConfig } from "../bindersconfig/binders";
import { Config } from "@binders/client/lib/config/config";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { ISAMLSSOConfig } from "./saml-sso/config";
import { Strategy as LocalStrategy } from "passport-local";
import { Maybe } from "@binders/client/lib/monad";
import {
    NotificationServiceClient
} from "@binders/client/lib/clients/notificationservice/v1/client";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TEN_YEARS } from "@binders/client/lib/util/time";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { WebAppConfig } from "../middleware/config";
import { WebRequest } from "../middleware/request";
import { extractInterfaceLanguageFromRequest } from "../util/i18n";
import { getClientIps } from "../util/ip";
import { getDomainForSSOSettings } from "./saml-sso/domains";
import { getDomainFromRequest } from "../util/domains";
import i18next from "@binders/client/lib/i18n";
import { isProduction } from "@binders/client/lib/util/environment";
import nodeHandler from "../apiclient/nodeclient";
import { omit } from "ramda";
import { prefixGeneratedAssets } from "../util/dom";
import { shouldBypassSSORedirect } from "./saml-sso";

const SSO_SKIP_LOGIN_PAGE_PARAM = "ssoLogin"

export interface PassportRouteConfig {
    homeRoute: string;
    loginRoute: string;
    signupRoute: string;
    loginTemplateFile?: string;
    signupTemplateFile?: string;
    loginCssPath?: string;
    logoutRoute: string;
}

export interface Authenticator {
    authenticate(login, plaintextPassword, userAgent?: string, disableConcurrentLogins?: boolean): Promise<AuthenticatedSession>;
    authenticateWithUserToken(token: string, accountId: string, userAgent: string, clientIp: string): Promise<AuthenticatedSession>;
}

export interface RequestInvitationHandler {
    requestInvitation(
        domain,
        email,
        interfaceLanguage: string,
        fromUserAgent?: string,
        fromUserId?: string,
        fromUserIp?: string | string[]
    ): Promise<string>;
}

export interface UserSerializer<T> {
    serialize(unserialized: AuthenticatedSession): Promise<T>;
    deserialize(serialized: T): Promise<AuthenticatedSession>;
}

export const getApplicationFromAppname = (appName: string): Application => {
    return {
        "reader": Application.READER,
        "reader-v1": Application.READER,
        "editor": Application.EDITOR,
        "editor-v2": Application.EDITOR,
        "manage": Application.MANAGE,
        "dashboard": Application.DASHBOARD,
    }[appName];
};

export class DefaultUserSerializer implements UserSerializer<string> {

    serialize(unserialized: AuthenticatedSession): Promise<string> {
        return Promise.resolve(JSON.stringify(unserialized));
    }

    deserialize(serialized: string): Promise<AuthenticatedSession> {
        return Promise.resolve(JSON.parse(serialized));
    }
}

export class CredentialManagerClientAuthenticator implements Authenticator {
    private credentialServiceClient: CredentialServiceClient;

    constructor(config: Config) {
        this.credentialServiceClient = CredentialServiceClient.fromConfig(config, "v1", nodeHandler);
    }

    authenticate(username: string, plainText: string, userAgent?: string, disableConcurrentLogins?: boolean): Promise<AuthenticatedSession> {
        return this.credentialServiceClient.loginWithPassword(username, plainText, userAgent, disableConcurrentLogins);
    }

    authenticateWithUserToken(token: string, accountId: string, userAgent: string, clientIp: string): Promise<AuthenticatedSession> {
        return this.credentialServiceClient.loginWithUserToken(token, accountId, userAgent, clientIp);
    }
}

export class UserServiceRequestInvitationHandler implements RequestInvitationHandler {

    private userServiceClient: UserServiceClient;
    private routingServiceClient: RoutingServiceClient;

    constructor(config: Config) {
        this.userServiceClient = UserServiceClient.fromConfig(config, "v1", nodeHandler);
        this.routingServiceClient = RoutingServiceClient.fromConfig(config, "v1", nodeHandler);
    }

    async requestInvitation(domain: string, email: string, interfaceLanguage: string, fromUserAgent?: string, fromUserId?: string, fromUserIp?: string): Promise<string> {
        const accountId = await getAccountIdFromRequestContext(domain, this.routingServiceClient);
        return this.userServiceClient.requestInvitation(accountId, domain, email, interfaceLanguage, fromUserAgent, fromUserId, fromUserIp);
    }
}

export class DefaultAuthenticator {
    static get(): Authenticator {
        const config = BindersConfig.get();
        return DefaultAuthenticator.fromConfig(config);
    }

    static fromConfig(config: Config): CredentialManagerClientAuthenticator {
        return new CredentialManagerClientAuthenticator(config);
    }
}

export class DefaultRequestInvitationHandler {
    static get(): RequestInvitationHandler {
        const config = BindersConfig.get();
        return new UserServiceRequestInvitationHandler(config);
    }
}

export interface LoginHandler {
    success: (request: WebRequest, session: AuthenticatedSession) => Promise<void>;
    failure: (request: WebRequest, reason: string) => Promise<void>;
}

const NOOPPromise = Promise.resolve(undefined);
const NOOPLoginHandler: LoginHandler = {
    success: () => NOOPPromise,
    failure: () => NOOPPromise
};

function getBrowserLanguageFromHeader(request: WebRequest) {
    const requestAcceptLanguage = request.headers["accept-language"];
    let browserLanguage: string;
    const lang: string = Array.isArray(requestAcceptLanguage) ? requestAcceptLanguage[0] : requestAcceptLanguage as string;
    for (const testLangCode of ["en", "fr", "nl"]) {
        if ((lang || "").toLowerCase().startsWith(testLangCode)) {
            browserLanguage = testLangCode;
            break;
        }
    }
    return browserLanguage || "en";
}

export class PassportConfiguration<T> {
    trackingServiceClient: TrackingServiceClient;
    accountServiceClient: AccountServiceClient;
    routingServiceClient: RoutingServiceClient;
    sessionRepo: SessionRepository;
    notificationServiceClient: NotificationServiceContract;

    constructor(
        public authenticator: Authenticator,
        private serializer: UserSerializer<T>,
        readonly routes: PassportRouteConfig,
        private onRequestInvitation: RequestInvitationHandler,
        private onLogin: LoginHandler = NOOPLoginHandler,
        private SAMLSSOConfig?: ISAMLSSOConfig,
    ) {
        const config: Config = BindersConfig.get();
        this.trackingServiceClient = TrackingServiceClient.fromConfig(config, "v1", nodeHandler);
        this.accountServiceClient = AccountServiceClient.fromConfig(config, "v1", nodeHandler);
        this.routingServiceClient = RoutingServiceClient.fromConfig(config, "v1", nodeHandler);
        this.sessionRepo = RedisSessionRepository.fromConfig(config);
        this.notificationServiceClient = NotificationServiceClient.fromConfig(config, "v1", nodeHandler, () => undefined)
    }

    apply(_expressApp: Express.Application, router: Router, appConfig: WebAppConfig = {} as WebAppConfig, isAPI = false): void {

        if (!isAPI) {
            const strategy = this.buildPassportLocalStrategy(appConfig);
            passport.use(strategy);
        }

        const serializer = this.serializer;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        passport.serializeUser<AuthenticatedSession>(function (user: AuthenticatedSession, done: any) {
            serializer.serialize(user).then(
                serializedUser => {
                    done(undefined, serializedUser);
                },
                err => done(err, false)
            );
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        passport.deserializeUser<T>(function (serializedValue, done: any) {
            serializer
                .deserialize(serializedValue)
                .then(deserializedUser => done(undefined, deserializedUser), err => done(err, false));
        });

        if (!isAPI) {
            this.setLoginAndOutHandler(router, appConfig);
        }
    }

    mustBeLoggedIn(): RequestHandler {
        const routes = this.routes;
        return function (req: WebRequest, res, next) {
            if (req.isAuthenticated()) {
                if (req.session.redirectRoute !== undefined) {
                    req.session.redirectRoute = undefined;
                }
                next();
            } else {
                if (req.session.redirectRoute === undefined) {
                    req.session.redirectRoute = req.originalUrl;
                }
                res.redirect(routes.loginRoute);
            }
        };
    }

    private buildPassportLocalStrategy(appConfig: WebAppConfig) {

        const callback = (req, username, password, done) => {
            const trimmedUserName = username && username.trim();
            // plug in header authentication (crate.io)
            const checkIfDisableConcurrentLoginsPromise = (appConfig.disableConcurrentLogins ? appConfig.disableConcurrentLogins(req) : Promise.resolve(false));
            checkIfDisableConcurrentLoginsPromise.
                then((disableConcurrentLogins) => this.authenticator.authenticate(trimmedUserName, password, req.headers["user-agent"], disableConcurrentLogins)).
                then(
                    authenticatedSession => {
                        done(undefined, authenticatedSession);
                    },
                    err => {
                        done(err, false);
                    }
                );
        };

        return new LocalStrategy({ passReqToCallback: true }, callback);
    }

    private requestInvitation() {
        const onRequestInvitation = this.onRequestInvitation;
        const routes = this.routes;

        const requestInvitationFn = function (req: WebRequest, res: Response) {
            const routesCopy = Object.assign({}, routes);
            if (req.proxyConfig) {
                routesCopy.signupRoute = `${req.proxyConfig.readerPath}${routesCopy.signupRoute}`;
            }
            onRequestInvitation.requestInvitation(
                req.body.domain,
                req.body.username,
                req.body.interfaceLanguage,
                req["headers"] && req["headers"]["user-agent"],
                req.user && req.user.userId,
                getClientIps(req),

            )
                .then(status => {
                    res.redirect(routesCopy.signupRoute + `?status=${status}`);
                })
                .catch(err => {
                    req.logger.error(err.toString(), "user-invite");
                    res.redirect(routesCopy.signupRoute + `?reason=${UiErrorCode.requestInviteError}`);
                });
        };
        return requestInvitationFn.bind(this);
    }

    private authenticate(appConfig: WebAppConfig) {
        const routes = this.routes;
        const displayLoginPage = this.renderLoginPage.bind(this);
        const onLogin = this.onLogin;
        const name = getApplicationFromAppname(appConfig.appName);
        const authenticateFn = async function (req: WebRequest, res, next: NextFunction) {
            const routesCopy = Object.assign({}, routes);
            if (req.proxyConfig) {
                routesCopy.homeRoute = `${req.proxyConfig.readerPath}${routesCopy.homeRoute}`;
                routesCopy.loginRoute = `${req.proxyConfig.readerPath}${routesCopy.loginRoute}`;
            }
            if (req.session.redirectRoute) {
                routesCopy.homeRoute = req.session.redirectRoute;
            }
            const failureMessage = UiErrorCode.loginInvalidCredentials;

            const handler: RequestHandler = passport.authenticate("local", async function (err, user) {
                if (err || !user) {
                    if (req.logger) {
                        req.logger.error("Failed to authenticate", "authentication", { error: err, user });
                    }
                    if (!user) {
                        onLogin.failure(req, failureMessage);
                    }
                    if (routesCopy.loginTemplateFile) {
                        const extraVars = appConfig.buildIndexTemplateVars ?
                            await appConfig.buildIndexTemplateVars(req) :
                            {};
                        displayLoginPage(req, res, getDomainFromRequest(req, name, { returnOnlySubdomain: true }), [failureMessage], appConfig, extraVars);
                        return;
                    } else {
                        return res.redirect(routesCopy.loginRoute);
                    }
                }
                req.login(user, function (error) {
                    if (error) {
                        if (req.logger) {
                            req.logger.error("Failed to authenticate", "authentication", { error });
                        }
                        onLogin.failure(req, failureMessage);
                        return res.next(error);
                    }

                    onLogin
                        .success(req, user)
                        .then(() => {
                            if (req.logger) {
                                req.logger.info("Successful authentication", "authentication", { user });
                            }
                            req.session.redirectRoute = undefined;

                            let cookieDomain: string | undefined;
                            if (isDev()) {
                                cookieDomain = undefined;
                            } else if (isStaging()) {
                                cookieDomain = "dev.binders.media";
                            } else {
                                cookieDomain = "manual.to";
                            }

                            res.cookie("impersonation", "", { maxAge: 0, domain: cookieDomain });

                            req.session.cookie.maxAge = user.isDeviceUser ?
                                TEN_YEARS :
                                getSessionMaxAge(BindersConfig.get());

                            const domainFromRequest = getDomainFromRequest(req, name, { returnOnlySubdomain: false });
                            const redirectAfterLoginRoute = `${routesCopy.homeRoute}${(isProduction() || routesCopy.homeRoute.includes("domain=")) ? "" : `?domain=${domainFromRequest}`}`;
                            if (isSafeForRedirect(redirectAfterLoginRoute)) {
                                res.redirect(redirectAfterLoginRoute);
                            } else {
                                req.logger?.warn(`Unsafe redirect prevented: ${redirectAfterLoginRoute}`, "unsafe-redirect");
                                res.redirect("/");
                            }
                        })
                        .catch(requestError => res.next(requestError));
                });
            });
            handler(req, res, next);
        };
        return authenticateFn.bind(this);
    }

    blockAccess(reason?: string): RequestHandler {
        const routes = this.routes;
        const blockAccessFn = async (req: WebRequest, res: Response) => {
            if (!reason && req.query["reason"]) {
                reason = req.query["reason"] as string;
            }
            const routesCopy = Object.assign({}, routes);
            if (req.proxyConfig && req.proxyConfig.readerPath) {
                routesCopy.homeRoute = `${req.proxyConfig.readerPath}${routesCopy.homeRoute}`;
                routesCopy.loginRoute = `${req.proxyConfig.readerPath}${routesCopy.loginRoute}`;
            }
            let route = "";
            if (reason) {
                const isLoginOrRoot = req.path === routesCopy.loginRoute || req.path === routesCopy.homeRoute;
                const isNotLoggedInOnLoginOrRoot = reason == UiErrorCode.loginToAccess && isLoginOrRoot;
                const params = isNotLoggedInOnLoginOrRoot ? "" : `?reason=${reason}`;
                route = `${routesCopy.loginRoute}${params}`;
            } else {
                route = (req.path === routesCopy.homeRoute ? routesCopy.loginRoute : routesCopy.homeRoute);
            }
            res.redirect(route);
        };
        return blockAccessFn.bind(this);
    }

    logout(): RequestHandler {
        const routes = this.routes;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const logoutFn = async (req: WebRequest, res) => {

            let reason: string;
            if (req.query["reason"]) {
                reason = req.query["reason"] as string;
            }

            const routesCopy = Object.assign({}, routes);
            if (req.proxyConfig) {
                routesCopy.homeRoute = `${req.proxyConfig.readerPath}${routesCopy.homeRoute}`;
                routesCopy.loginRoute = `${req.proxyConfig.readerPath}${routesCopy.loginRoute}`;
            }

            const accountId: string = req.query["accountId"] as string;
            const windowId: string = req.query["windowId"] as string;

            const event: EventPayload = {
                eventType: EventType.USER_LOGGED_OFF,
                accountId,
                data: {
                    accountIds: req.user ? req.user.accountIds : undefined,
                    userAgent: req.user ? req.user.userAgent : undefined,
                    reason: reason ? reason : undefined
                }
            };
            self.trackingServiceClient.log([event], req.user ? req.user.userId : undefined);
            if (req.user) {
                self.notificationServiceClient.dispatch(
                    {
                        type: RoutingKeyType.ACCOUNT,
                        value: accountId
                    },
                    ServiceNotificationType.USER_LOGGED_OFF,
                    {
                        sessionId: req?.user?.sessionId,
                        windowId
                    },
                )
            }


            await this.sessionRepo.endSession(req.user);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (req as any).logout(() => {
                clearCookies(req, res, true);
                let route: string;
                if (reason) {
                    route = `${routesCopy.loginRoute}?reason=${reason}`;
                } else {
                    route = req.path === routesCopy.homeRoute ? routesCopy.loginRoute : routesCopy.homeRoute;
                    const domain = getDomainFromRequest(req, undefined);
                    if (domain) {
                        if (route.includes("?")) {
                            route = `${route}&domain=${domain}`;
                        } else {
                            route = `${route}?domain=${domain}`;
                        }
                    }

                }
                res.redirect(route);
            });
        };
        return logoutFn.bind(this);
    }

    private maybePrepareRedirectUrl(url: string | undefined, params: Record<string, unknown>): Maybe<string> {
        if (url) {
            const queryParamsToPass = Object.keys(params).map(
                (p) => `${p}=${params[p]}`);
            if (queryParamsToPass.length > 0) {
                return Maybe.just(`${url}?${queryParamsToPass.join("&")}`);
            }
            return Maybe.just(url);
        }
        return Maybe.nothing();
    }

    private getRedirectUrlQuery({ session, query }: WebRequest, pathPrefix: string) {
        // session.redirectRoute - editor, query.redirectUrl - reader\
        const paramsToSkip = ["redirectUrl", "reason"];
        const redirectUrl = this.maybePrepareRedirectUrl(
            query.redirectUrl || session.redirectRoute,
            omit(paramsToSkip, query)
        );

        const redirectUrlValue = redirectUrl.isJust() ? redirectUrl.get() : undefined;

        let redirectUrlQuery;
        if (session.redirectRoute && redirectUrlValue && redirectUrlValue === session.redirectUrl) {
            redirectUrlQuery = session.redirectRoute;
        } else {
            redirectUrlQuery = redirectUrl.isJust() ? redirectUrl.get() : `${pathPrefix}/`;
        }
        return redirectUrlQuery;
    }

    private getLoginCssPathWithBranding(request: WebRequest) {
        const externalCss = this.routes.loginCssPath;
        if (externalCss === undefined) {
            return undefined;
        }
        const query = request.url ? parseQueryString(request.url) : {};
        if (!("domain" in query)) {
            return externalCss;
        }
        // TODO MT-4121 why not getDomainFromRequest or getHostnameForRequest ?
        return `${externalCss}?domain=${query["domain"]}`;
    }

    private async renderLoginPage(
        req: WebRequest,
        res: Response,
        subdomain: string,
        failures: string[] = [],
        appConfig: WebAppConfig,
        extraTemplateVars: Record<string, unknown>
    ): Promise<void> {
        const getHostName = () => {
            if (isStaging() || isDev()) {
                return req.query["domain"] || req.hostname;
            }
            return req.hostname;
        };
        // TODO MT-4121 use either getDomainFromRequest or getHostnameForRequest
        const domain = getHostName();
        const domainFromRequest = getDomainFromRequest(req, getApplicationFromAppname(appConfig.appName), { returnOnlySubdomain: false });
        const proxyConfiguration = req.proxyConfig;
        const interfaceLanguage = await extractInterfaceLanguageFromRequest(req);
        const t = (key: string) => i18next.t(key, { lng: interfaceLanguage });

        try {
            let samlSSOMode = SAMLSSOMode.DISABLED;
            let samlConfig = defaultSAMLSSOSettings();
            if (this.SAMLSSOConfig) {
                samlConfig = await this.SAMLSSOConfig.getConfiguration(getDomainForSSOSettings(req));
                samlSSOMode = this.SAMLSSOConfig.getSSOModeForConfiguration(samlConfig);
            }

            const shouldRedirect =
                (samlSSOMode === SAMLSSOMode.SINGLE_AUTH) ||
                (samlSSOMode === SAMLSSOMode.MULTI_AUTH && req.query[SSO_SKIP_LOGIN_PAGE_PARAM] === "1");

            const shouldBypassRedirect = shouldBypassSSORedirect(req);

            if (shouldRedirect && !shouldBypassRedirect) {
                const suffix = isProduction() ? "" : `?domain=${domainFromRequest}`;
                const redirectTarget = this.SAMLSSOConfig.getLoginRoute() + suffix;
                return res.redirect(redirectTarget);
            }
            const showSAMLConnectButton = samlSSOMode !== SAMLSSOMode.DISABLED;
            const ssoProvider = samlConfig?.provider;
            const ssoButtonText = samlConfig?.ssoButtonText || i18next.t(TranslationKeys.Login_WithProvider, { providerName: resolveSSOProviderName(ssoProvider) });

            // TODO MT-4121 use either getDomainFromRequest or getHostnameForRequest
            const SAMLSSOLink = this.SAMLSSOConfig &&
                `${this.SAMLSSOConfig.getLoginRoute()}${((isDev() || isStaging()) && req.query["domain"]) ? `?domain=${domain}` : ""}`;

            const pathPrefix = (proxyConfiguration && proxyConfiguration.readerPath) ?
                proxyConfiguration.readerPath :
                "";
            const loginFormAction = `${pathPrefix}/login${isProduction() ? "" : `?domain=${domainFromRequest}`}`;

            const redirectRoute = this.getRedirectUrlQuery(req, pathPrefix);

            if (redirectRoute) {
                req.session.redirectRoute = redirectRoute;
            }

            // TODO MT-4121 this will probably always be true
            const showPasswordReset = isProduction() ?
                subdomain !== "editor." :
                true;

            const externalCss = this.getLoginCssPathWithBranding(req);
            const data = {
                externalCss,
                failures: failures.map(f => translateUiErrorCode(t, f)),
                subdomain,
                showPasswordReset,
                fontLinks: [],
                brandingOverride: domainFromRequest,
                showSAMLConnectButton,
                ssoButtonText,
                ssoProvider,
                SAMLSSOLink,
                brandingColor: undefined,
                pathPrefix,
                loginFormAction,
                faviconUrl: null,
                config: "{}",
                ...extraTemplateVars,
            };

            let contents = fs.readFileSync(this.routes.loginTemplateFile, "utf8");

            if (pathPrefix) {
                contents = prefixGeneratedAssets(contents, pathPrefix);
            }

            const str = ejs.render(contents, data, {});

            res.send(str);
            res.end();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(error);
            res.status(500);
            res.send("Could not render login form." + error);
        }
    }
    private async renderSignupPage(req: WebRequest, res: Response, subdomain: string, failures = [], status: string, extraTemplateVars: Record<string, unknown>) {
        const externalCss = this.getLoginCssPathWithBranding(req);
        ejs.renderFile(this.routes.signupTemplateFile, {
            fontLinks: [],
            brandingColor: undefined,
            externalCss,
            failures,
            subdomain,
            status,
            ...extraTemplateVars,
        }, {}, function (err, str) {
            if (err) {
                res.status(500);
                res.send("Could not render signup form.");
            } else {
                res.send(str);
            }
        });
    }

    private async buildSignupMessages(request: WebRequest, application: Application) {
        const interfaceLanguage = await extractInterfaceLanguageFromRequest(request);
        const domain = getDomainFromRequest(request, application, { returnOnlySubdomain: false });
        const accountId = await getAccountIdFromRequestContext(domain, this.routingServiceClient);
        const accountFeatures = await getAccountFeaturesFromRequestContext(accountId, this.accountServiceClient);
        const featuresInterfaceI18N = accountFeatures.includes(FEATURE_INTERFACE_I18N);
        const t = (key: string) => i18next.t(key, { lng: interfaceLanguage });
        return {
            checkEmailToContinue: t(TranslationKeys.General_CheckEmailToContinue),
            checkSpam: t(TranslationKeys.General_CheckSpam),
            emailAddress: t(TranslationKeys.General_EmailAddress),
            existingAccount: t(TranslationKeys.Signup_ExistingAccount),
            here: t(TranslationKeys.General_Here),
            signupPageTitle: t(TranslationKeys.Signup_PageTitle),
            submit: t(TranslationKeys.General_Submit),
            fillOutForm: t(TranslationKeys.General_FillOutForm),
            toReceiveInvitation: t(TranslationKeys.Signup_ToReceiveInvitation),
            thanks: t(TranslationKeys.General_Thanks),
            problemWithSignup: t(TranslationKeys.User_ProblemWithSignup),
            preferredLanguage: t(TranslationKeys.General_PreferredLanguage),
            featuresInterfaceI18N,
            browserLanguage: getBrowserLanguageFromHeader(request),
            email: t(TranslationKeys.General_Email),
        };
    }

    private setLoginAndOutHandler(router: Router, appConfig: WebAppConfig) {
        const displayLoginPage = this.renderLoginPage.bind(this);
        const displaySignupPage = this.renderSignupPage.bind(this);
        const name = getApplicationFromAppname(appConfig.appName);
        if (this.routes.loginTemplateFile) {
            router.get(this.routes.loginRoute, async (req: WebRequest, res: Response) => {
                const extraVars = appConfig.buildIndexTemplateVars ?
                    await appConfig.buildIndexTemplateVars(req) :
                    {};
                const reasons = [];
                if (req.query.reason) {
                    reasons.push(req.query.reason);
                }
                displayLoginPage(req, res, getDomainFromRequest(req, name, { returnOnlySubdomain: true }), reasons, appConfig, extraVars);
            });
        }
        if (this.routes.signupTemplateFile) {
            router.get(this.routes.signupRoute, async (req: WebRequest, res: Response) => {
                const templateVars = appConfig.buildIndexTemplateVars ?
                    await appConfig.buildIndexTemplateVars(req) :
                    {};
                const messages = await this.buildSignupMessages(req, name);
                const extraVars: Record<string, unknown> = {...templateVars, messages };
                const reasons = [];
                if (req.query.reason) {
                    reasons.push(req.query.reason);
                }
                displaySignupPage(req, res, getDomainFromRequest(req, name, { returnOnlySubdomain: true }), reasons, req.query.status, extraVars);
            });
        }
        router.post(
            this.routes.loginRoute,
            this.authenticate(appConfig)
        );

        router.post(
            this.routes.signupRoute,
            this.requestInvitation()
        );

        router.get(
            this.routes.logoutRoute,
            this.logout()
        );
    }
}
