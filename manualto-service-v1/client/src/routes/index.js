import * as React from "react";
import { Application, EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BrowserRouter, Redirect, Route, Switch } from "react-router-dom";
import { ReaderRouter, loadLaunch, loadPreview, loadRead } from "./reader-routes";
import {
    defaultLanguage,
    getInterfaceLanguage,
    switchInterfaceLanguage
} from "@binders/client/lib/i18n";
import { getReaderDomain, toFullPath } from "../util";
import { loadAccountFeatures, loadAccountSettings } from "../stores/actions/account";
import { loadDomainAccounts, loadReaderItems } from "../binders/binder-loader";
import AcceptedTerms from "../elements/acceptedterms";
import AccountExpired from "../views/errorpages/accountexpired";
import CollectionBrowser from "../views/browsing/collection-browser.lazy";
import { ConnectionStateProvider } from "@binders/ui-kit/lib/providers/ConnectionStateProvider";
import ContentNotFound from "../views/errorpages/notfound";
import { DeviceLoginModal } from "../views/deviceuser/DeviceLoginModal/DeviceLoginModal";
import DomainNotFound from "../views/errorpages/domainnotfound";
import { FIVE_MINUTES } from "@binders/client/lib/util/time";
import FontsPreloader from "./FontsPreloader";
import { InactivityContextProvider } from "@binders/client/lib/inactivity/inactivityContext";
import { LaunchDarklyFlagsProvider } from "../account/launchdarkly-flags-provider";
import { LoadingFullPage } from "../views/lazy/Loading";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import { ModalView } from "@binders/ui-kit/lib/compounds/modals/ModalView";
import { ReactQueryProvider } from "../react-query";
import ReaderDeployMonitor from "../elements/readerDeployMonitor";
import RedirectWithSearch from "./redirect";
import ResetPassword from "../account/ResetPassword";
import { Ribbons } from "../utils/ribbons";
import SearchResults from "../views/search/search-results";
import SemanticIdComponent from "./SemanticIdComponent";
import StoryBrowser from "../views/browsing/story-browser";
import Theme from "@binders/ui-kit/lib/theme";
import { Trackers } from "../tracking";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { UiErrorCode } from "@binders/client/lib/errors";
import Unauthorized from "../views/errorpages/unauthorized";
import UserSettingsRoutes from "./user-settings-routes";
import WiredAutoLogoutHandler from "./WiredAutoLogoutHandler";
import { apiLogEvents } from "../api/trackingService";
import autoBind from "class-autobind";
import { closeWs } from "../api/notificationService";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { getAndDispatchPreferredLanguages } from "../util";
import { getImpersonationInfo } from "@binders/client/lib/util/impersonation";
import { logClientError } from "@binders/client/lib/util/clientErrors";
import { myDetails } from "../binders/loader";
import { setupNotifications } from "../notification/actions";
import tokenStore from "@binders/client/lib/clients/tokenstore";
import { useIsLoggedOut } from "../stores/hooks/user-hooks";
import { useUserStoreActions } from "../stores/zustand/user-store";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "../main.styl";

const {
    BROWSE,
    SEARCH,
    RESET_PASSWORD,
    LAUNCH,
    PREVIEW,
    READ,
    USER_SETTINGS,
    ROUTE_401,
    NOT_FOUND,
} = ManualToRoutes;

class Routes extends React.Component {

    constructor(props) {
        super(props);
        this.wrapRouter = this.wrapRouter.bind(this);
        this.loadLoggedUser = this.loadLoggedUser.bind(this);
        this.loadUserDetails = this.loadUserDetails.bind(this);
        this.loadPublicDetails = this.loadPublicDetails.bind(this);
        autoBind(this);
        this.state = {
            preferredLanguages: null,
            readerItemsLoaded: false,
            userDetails: undefined,
            userDetailsLoaded: undefined,
            domainNotFound: false,
            features: undefined,
        };
    }

    async componentDidMount() {
        window.addEventListener("error", this.handleError);

        const { accounts, features } = await this.loadAccountsAndFeatures();
        const impersonationInfo = getImpersonationInfo();
        const accountExpired = accounts.every(acc => acc.isReaderExpired);
        this.setState({ accountExpired });

        let userPreferences = undefined;
        if (!accountExpired) {
            const userDetails = await this.maybeLoadUser(accounts, impersonationInfo?.isAdminImpersonatedSession);
            userPreferences = userDetails?.preferences;
        }

        if (accounts.length === 0 || (!tokenStore.hasAnyToken())) {
            await this.loadPublicDetails();
        }
        const accountSettings = await loadAccountSettings(accounts[0].id, tokenStore.isPublic());
        const interfaceLanguage = getInterfaceLanguage(features, accountSettings, userPreferences);
        if (interfaceLanguage !== defaultLanguage) {
            switchInterfaceLanguage(interfaceLanguage);
        }
        this.setState({
            impersonationInfo,
            accountIds: accounts.map(a => a.id),
            features,
            interfaceLanguage
        });

        setupNotifications(this.getUserId());
        eventQueue.setSendMethod(apiLogEvents);
    }

    redirectIfUserLoggedOff() {
        const { isUserLoggedOff } = this.props;
        if (isUserLoggedOff) {
            if (this.state.impersonationInfo?.isImpersonatedSession) {
                window.location.href = "/stopimpersonation";
            } else {
                window.location.href = `/logout?reason=${UiErrorCode.sessionEnd}`;
            }
        }
    }

    componentWillUnmount() {
        closeWs();
        window.removeEventListener("error", this.handleError.bind(this));
        if (this.logUserIsOnlineIntervalID) {
            clearInterval(this.logUserIsOnlineIntervalID);
        }
    }

    componentDidCatch(error) {
        this.handleError(error);
    }

    async maybeLoadUser(accounts, isAdminImpersonatedSession) {
        let userDetails;
        if (tokenStore.hasAnyToken()) {
            userDetails = await this.loadLoggedUser(isAdminImpersonatedSession, accounts);
        }
        this.setState({
            userDetailsLoaded: !!userDetails,
        });
        return userDetails;
    }

    async loadAccountsAndFeatures() {
        try {
            const accounts = await loadDomainAccounts();
            if (!accounts || accounts.length === 0) {
                const readerDomain = getReaderDomain();
                this.setState({
                    domainNotFound: true,
                });
                throw new Error(this.props.t(TranslationKeys.Account_NotFoundForDomain, { readerDomain }));
            }
            const features = await loadAccountFeatures(accounts[0].id);
            return { accounts, features };
        } catch (error) {
            this.handleError(error);
        }

        return [];
    }

    getUserId() {
        if (tokenStore.hasInternalToken()) {
            const { user } = this.state.userDetails;
            return user.id;
        }
        return "public";
    }

    async handleError(error) {
        logClientError(Application.READER, error);
        return false;
    }

    async loadLoggedUser(isAdminImpersonatedSession, accounts) {
        const details = await this.loadUserDetails();
        const userId = this.getUserId();
        const accountId = accounts[0].id;
        if (tokenStore.hasInternalToken()) {
            this.logUserIsOnline(accountId, userId, isAdminImpersonatedSession, true);
            this.logUserIsOnlineIntervalID = setInterval(() => this.logUserIsOnline(
                accountId,
                userId,
                isAdminImpersonatedSession,
            ), FIVE_MINUTES);
        }
        return details;
    }

    logUserIsOnline(accountId, userId, isAdminImpersonatedSession, now = false) {
        if (
            !userId ||
            userId === "public" ||
            isAdminImpersonatedSession ||
            tokenStore.isPublic()
        ) {
            return;
        }
        eventQueue.log(
            EventType.USER_IS_ONLINE,
            accountId,
            {
                application: Application.READER,
                domain: getReaderDomain(),
                userId,
            },
            now,
            userId,
        );
    }

    async loadUserDetails() {
        const userDetails = await myDetails();
        const preferredLanguages = getAndDispatchPreferredLanguages(userDetails?.preferences);
        this.props.userActions.setSessionId(userDetails?.sessionId);
        this.props.userActions.loadUser(userDetails?.user);
        this.props.userActions.updatePreferences(userDetails?.preferences);
        this.props.userActions.setIsAllowedToChangePassword(userDetails?.isAllowedToChangePassword);
        this.setState({ preferredLanguages, userDetails }, () => this.loadReaderItems());
        return userDetails;
    }

    async loadPublicDetails() {
        this.props.userActions.setIsPublic(true);
        const preferredLanguages = getAndDispatchPreferredLanguages({});
        this.setState({ preferredLanguages }, () => this.loadReaderItems());
    }

    async loadReaderItems() {
        const { preferredLanguages } = this.state;
        if (preferredLanguages) {
            await loadReaderItems(preferredLanguages);
        }
        this.setState({ readerItemsLoaded: true });
    }

    wrapRouter(Component, props) {
        const { preferredLanguages: languages } = this.state;
        const wrapFn = router => <Component router={router} preferredLanguages={languages} {...props} />;
        return wrapFn;
    }

    render() {
        let { wrapRouter } = this;
        const { accountIds, domainNotFound, accountExpired, userDetails,
            features, readerItemsLoaded } = this.state;
        if (domainNotFound) {
            return <DomainNotFound />
        }
        if (accountExpired) {
            return <AccountExpired />
        }
        if (!readerItemsLoaded || !features) {
            return <LoadingFullPage />;
        }
        wrapRouter = wrapRouter.bind(this)
        this.redirectIfUserLoggedOff();
        return this.state.preferredLanguages && (
            <Theme>
                <ConnectionStateProvider>
                    <Ribbons
                        impersonationInfo={this.state.impersonationInfo}
                        userDetails={this.state.userDetails?.user}
                    >
                        <ReactQueryProvider>
                            <ReaderDeployMonitor>
                                <LaunchDarklyFlagsProvider>
                                    <Trackers />
                                    <AcceptedTerms
                                        userDetails={userDetails}
                                        accountFeatures={features}
                                        onAccept={this.loadUserDetails.bind(this)}
                                    >
                                        <InactivityContextProvider>
                                            <WiredAutoLogoutHandler>
                                                <ModalView>
                                                    <FontsPreloader>
                                                        <DeviceLoginModal />
                                                        <div className="reader-component">
                                                            <Switch>
                                                                <Route exact path={toFullPath(BROWSE)} component={wrapRouter(StoryBrowser)} />
                                                                <Route path={toFullPath(`${BROWSE}/*/:collectionId`)} component={wrapRouter(CollectionBrowser, { accountIds })} />
                                                                <Route path={toFullPath(`${BROWSE}/:collectionId`)} component={wrapRouter(CollectionBrowser, { accountIds })} />
                                                                <Route path={toFullPath(`${SEARCH}/:scopeCollectionId`)} component={wrapRouter(SearchResults, { features })} />
                                                                <Route path={toFullPath(SEARCH)} component={wrapRouter(SearchResults, { features })} />
                                                                <Route path={toFullPath(RESET_PASSWORD)} component={ResetPassword} />

                                                                <Route path={toFullPath(`${LAUNCH}/**/:collectionId/:binderId`)}
                                                                    component={router => <ReaderRouter accountIds={accountIds} router={router} loadFn={loadLaunch} />}
                                                                />
                                                                <Route path={toFullPath(`${LAUNCH}/:collectionId/:binderId`)}
                                                                    component={router => <ReaderRouter accountIds={accountIds} router={router} loadFn={loadLaunch} />}
                                                                />
                                                                <Route path={toFullPath(`${LAUNCH}/:binderId`)}
                                                                    component={router => <ReaderRouter accountIds={accountIds} router={router} loadFn={loadLaunch} />}
                                                                />
                                                                <Route path={toFullPath(`${PREVIEW}/**/:collectionId/:binderId`)}
                                                                    component={router => <ReaderRouter accountIds={accountIds} router={router} loadFn={loadPreview} />}
                                                                />
                                                                <Route path={toFullPath(`${PREVIEW}/:collectionId/:binderId`)}
                                                                    component={router => <ReaderRouter accountIds={accountIds} router={router} loadFn={loadPreview} />}
                                                                />
                                                                <Route path={toFullPath(`${PREVIEW}/:binderId`)}
                                                                    component={router => <ReaderRouter accountIds={accountIds} router={router} loadFn={loadPreview} />}
                                                                />
                                                                <Route path={toFullPath(`${READ}/**/:collectionId/:publicationId`)}
                                                                    component={router => <ReaderRouter accountIds={accountIds} router={router} loadFn={loadRead} />}
                                                                />
                                                                <Route path={toFullPath(`${READ}/:collectionId/:publicationId`)}
                                                                    component={router => <ReaderRouter accountIds={accountIds} router={router} loadFn={loadRead} />}
                                                                />
                                                                <Route path={toFullPath(`${READ}/:publicationId`)}
                                                                    component={router => <ReaderRouter accountIds={accountIds} router={router} loadFn={loadRead} />}
                                                                />

                                                                <UserSettingsRoutes path={toFullPath(`${USER_SETTINGS}/*`)} />
                                                                <Route path={ROUTE_401} component={Unauthorized} />
                                                                <Route path={NOT_FOUND} component={ContentNotFound} />
                                                                <Redirect from={toFullPath(USER_SETTINGS)} to={toFullPath(`${USER_SETTINGS}/info`)} />
                                                                <RedirectWithSearch exact from={toFullPath("/")} to={toFullPath(BROWSE)} />
                                                                <Route path={toFullPath("/*")} component={wrapRouter(SemanticIdComponent, { accountIds })} />
                                                            </Switch>
                                                        </div>
                                                    </FontsPreloader>
                                                </ModalView>
                                            </WiredAutoLogoutHandler>
                                        </InactivityContextProvider>
                                    </AcceptedTerms>
                                </LaunchDarklyFlagsProvider>
                            </ReaderDeployMonitor>
                        </ReactQueryProvider>
                    </Ribbons>
                </ConnectionStateProvider>
            </Theme >
        )
    }
}

const RoutesContainer = withHooks(Routes, () => ({
    isUserLoggedOff: useIsLoggedOut(),
    userActions: useUserStoreActions(),
}));

const App = () => (
    <BrowserRouter>
        <Route path="/" component={withTranslation()(RoutesContainer)} />
    </BrowserRouter>
);

export default App;
