import * as React from "react";
import {
    APISubscribeToRoutingKeys,
    APIUnsubscribeFromRoutingKeys,
    closeWs
} from "../notification/api";
import {
    Account,
    AccountFeatures,
    FEATURE_APPROVAL_FLOW,
    FEATURE_CONTRIBUTOR_ROLE,
    FEATURE_REDIRECT_TO_EDITOR
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { IWebData, WebData, WebDataState } from "@binders/client/lib/webdata";
import { QUERY_PARAM_DOMAIN, useQueryParam } from "@binders/client/lib/react/hooks/useQueryParams";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    activateAccountId,
    clearAccountFeatures,
    getAdminGroup,
    loadAccountFeatures,
    myAccounts
} from "../accounts/actions";
import { getAccountUsergroupsKey, invalidateQuery } from "../users/query";
import onKeyDown, { isGodModeEnabled } from "@binders/client/lib/react/handlers/onKeyDown";
import { useActiveAccountId, useReloadAccount } from "../accounts/hooks";
import { APIGetAccountDomains } from "../accounts/api";
import { APILogEvents } from "../tracking/api";
import { AbsolutePositioningContextProvider } from "../shared/Layout/absolutePositioningContext";
import AcceptedTerms from "../users/acceptedterms";
import { AccountLogoFavicon } from "../accounts/AccountLogoFavicon/AccountLogoFavicon";
import AccountStore from "../accounts/store";
import { Alerts } from "../notification/alerts/Alerts";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { ClickHandlerContextProvider } from "../shared/ClickHandler/ClickHandlerContext";
import { ConnectionStateProvider } from "@binders/ui-kit/lib/providers/ConnectionStateProvider";
import { Container } from "flux/utils";
import { DirtyStateContextProvider } from "../shared/DirtyStateContext";
import EditLockingRedirection from "../editlocking/EditLockingRedirection";
import EditorDeployMonitor from "../notification/deployMonitor";
import { ErrorFullPage } from "./error";
import FallbackComponent from "./FallbackComponent";
import { FlashMessages } from "../logging/FlashMessages";
import IE11WarningBanner from "@binders/ui-kit/lib/compounds/banners/ie11warning";
import { InactivityContextProvider } from "@binders/client/lib/inactivity/inactivityContext";
import { LaunchDarklyFlagsProvider } from "../accounts/launchdarkly-flags-provider";
import { MyDetailsLoader } from "./MyDetailsLoader";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RedirectionNotifications } from "../notification/redirection";
import { RegularSessionCookieBannerWrapper } from "../tracking/RegularSessionCookieBannerWrapper";
import { Ribbons } from "../shared/Ribbons";
import { RoutingKeyType } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import ThemeProvider from "@binders/ui-kit/lib/theme";
import { Trackers } from "../tracking";
import { UiErrorCode } from "@binders/client/lib/errors";
import { VisualModalContextProvider } from "../media/VisualModal";
import { WebDataComponent } from "@binders/ui-kit/lib/elements/webdata";
import WiredAutoLogoutHandler from "./WiredAutoLogoutHandler";
import { accountUsers } from "../users/actions";
import { checkImpersonatedSession } from "../stores/impersonation-store";
import { checkWebDataTransition } from "@binders/client/lib/webdata/helpers";
import { clearBrowseItems } from "../documents/actions";
import { enableGodMode } from "../shared/helper";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { isIOSSafari } from "@binders/client/lib/react/helpers/browserHelper";
import { isProduction } from "@binders/client/lib/util/environment";
import { loadAllAccountRoles } from "../accounts/actions";
import { logClientError } from "@binders/client/lib/util/clientErrors";
import { logUserIsOnline } from "../tracking/actions";
import { useCurrentUserId } from "../users/hooks";
import { useIsAdminImpersonatedSession } from "../stores/impersonation-store";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "../styles/main.css";
import "../styles/global.styl";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            refetchIntervalInBackground: false
        }
    }
});

type AppState = {
    data: IWebData<{
        myAccounts: Account[];
        accountFeatures: AccountFeatures,
    }>;
    accountId: string;
};

class App extends WebDataComponent<AppState> {

    private logUserIsOnlineIntervalID;

    static getStores() {
        return [
            AccountStore,
        ]
    }

    static calculateState(prevState: AppState) {
        const data = WebData.compose({
            myAccounts: AccountStore.myAccounts(),
            accountFeatures: AccountStore.getAccountFeatures(),
        });
        checkWebDataTransition("App", prevState?.data, data);
        return {
            data,
            accountId: AccountStore.getActiveAccountId(),
        };
    }

    static getDerivedStateFromError(error) {
        const activeAccount = AccountStore.getActiveAccount();
        const accountFeatures: AccountFeatures = AccountStore.getAccountFeatures().result ?? [];
        return {
            accountFeatures,
            activeAccount,
            headerImage: activeAccount?.thumbnail,
            hasError: true,
            error,
        };
    }

    constructor(props) {
        super(props);
        this.monitorUncaughtErrors = this.monitorUncaughtErrors.bind(this);
        this.logUserIsOnline = this.logUserIsOnline.bind(this);
        this.reconnectSafariToSocket = this.reconnectSafariToSocket.bind(this);
        window.addEventListener("error", this.monitorUncaughtErrors);
    }

    async componentDidMount(): Promise<void> {
        checkImpersonatedSession();
        // Load my accounts AND activate the first
        const userAccounts = await myAccounts();
        if (!userAccounts || userAccounts.length === 0) {
            window.location.href = `/login?reason=${UiErrorCode.noAccessEditor}`;
            return;
        }
        // Set up god mode shizzle
        document.addEventListener("keydown", onKeyDown);
        if (isGodModeEnabled()) {
            enableGodMode();
        }
        eventQueue.setSendMethod(APILogEvents);
        // CookieLaw Warning Events

        this.logUserIsOnlineIntervalID = setInterval(this.logUserIsOnline.bind(this), 5000);
        // Disable for now, we can revisit later
        // window.addEventListener("focus", this.reconnectSafariToSocket);
    }

    async componentDidUpdate(_prevProps, prevState) {
        const { accountId, data: { partials } } = this.state;
        const { accountId: prevAccountId, data: { partials: prevPartials } } = prevState;

        const { myAccounts: myAccountsWD, accountFeatures: accountFeaturesWD } = partials;
        const { myAccounts: prevMyAccountsWD, accountFeatures: prevAccountFeaturesWD } = prevPartials;

        const { PENDING, SUCCESS } = WebDataState;
        const hasLoadedMyAccounts = (!prevMyAccountsWD || prevMyAccountsWD.status === PENDING) && myAccountsWD.status === SUCCESS;
        const hasLoadedAccountFeatures = (!prevAccountFeaturesWD || prevAccountFeaturesWD.status === PENDING) && accountFeaturesWD.status === SUCCESS;
        const myAccountsLoaded = myAccountsWD.status === SUCCESS;
        const hasNewAccountId = !!accountId && (accountId !== prevAccountId);

        if (myAccountsLoaded) {
            const needed = await this.maybeSwitchAccount(myAccountsWD.data || []);
            if (needed) return;
        }

        if (hasNewAccountId) {
            clearAccountFeatures();
            const features = await loadAccountFeatures(accountId);
            this.redirectToDomainIfNeeded(features, accountId, myAccountsWD);
            getAdminGroup(accountId);
            this.unsubscribeFromNotificationService(prevState.accountId || null);
            APISubscribeToRoutingKeys([{
                type: RoutingKeyType.ACCOUNT,
                value: accountId,
            }]);
            // at first load we do not have all accounts loaded
            if (myAccountsLoaded) {
                this.loadUsersAndGroups(accountId);
            }
        }
        if (hasLoadedAccountFeatures && accountId) {
            const accountFeatures = accountFeaturesWD.result;
            const includeContributorRole = accountFeatures.includes(FEATURE_CONTRIBUTOR_ROLE);
            const includeReviewerRole = accountFeatures.includes(FEATURE_APPROVAL_FLOW);
            loadAllAccountRoles(accountId, includeContributorRole, includeReviewerRole);
            this.redirectToDomainIfNeeded(accountFeatures, accountId, myAccountsWD);
        }

        // so we do it when it is ready
        if (hasLoadedMyAccounts) {
            // we need accounts because AccountStore.getAccount uses myAccounts
            // and that's how we get the users in accountUsers function
            this.loadUsersAndGroups(accountId);
        }

    }

    componentDidCatch(error) {
        this.monitorUncaughtErrors(error);
    }

    componentWillUnmount() {
        closeWs();
        window.removeEventListener("error", this.monitorUncaughtErrors);
        clearInterval(this.logUserIsOnlineIntervalID);
    }

    /**
     * @param accounts - list of user accessible accounts
    */
    async maybeSwitchAccount(accounts: Account[]): Promise<boolean> {
        const currentAccountId = this.state.accountId;
        const queryDomain = this.props.queryDomain;
        const currentAccount = accounts.find(a => a.id === currentAccountId);

        const stripAccountSwitchSearchParam = () => {
            const newUrl = new URL(window.location.href);
            if (newUrl.searchParams.get("domain")) {
                newUrl.searchParams.delete("domain");
                window.history.replaceState(null, "", newUrl.toString());
            }
        }

        try {
            if (currentAccount && currentAccount.domains.includes(queryDomain)) return false;
            const newAccount = accounts.find(acc => acc.domains.includes(queryDomain));
            if (!newAccount) return false;
            this.props.reloadAccount(newAccount.id);
            return true;
        } finally {
            stripAccountSwitchSearchParam();
        }
    }

    async redirectToDomainIfNeeded(features: AccountFeatures, accountId: string, accountsWD: IWebData<Account[]>): Promise<void> {
        if (!features.includes(FEATURE_REDIRECT_TO_EDITOR) || this.state.redirecting) {
            return;
        }

        let domain: string | undefined;

        const hasAccounts = accountsWD && accountsWD.state === WebDataState.SUCCESS;
        if (hasAccounts) {
            const account = (accountsWD.data || []).find(acc => acc.id === accountId);
            domain = account && account.domains.length > 0 && account.domains[0];
        }

        if (!domain) {
            const domains = await APIGetAccountDomains(accountId);
            domain = domains[0];
        }

        if (!domain) {
            return;
        }

        const editorSuffix = "editor.manual.to";
        const editorDomain = domain.replace("manual.to", editorSuffix);
        const host = window.location.host;
        const href = window.location.href;

        if (isProduction()) {
            if (host === editorDomain) {
                return;
            }
            const url = href.replace(host, editorDomain);
            return window.location.replace(url);
        }

        const q = window.location.search;
        const params = new URLSearchParams(q);
        const domainParam = params.get("domain");
        if (!domainParam || !domainParam.includes(editorSuffix)) {
            params.set("domain", editorDomain);

            const url = q ? href.replace(q, `?${params.toString()}`) : `${href}?${params.toString()}`;
            return window.location.replace(url);
        }

        if (domainParam.includes(editorSuffix) && hasAccounts) {
            const targetDomain = domainParam.replace(editorSuffix, "manual.to");
            const newAccount = (accountsWD.data || []).find(acc => acc.domains.includes(targetDomain));

            if (newAccount && domainParam !== editorDomain) {
                this.setState({ redirecting: true }, async () => {
                    const newUrl = `${window.location.protocol}//${window.location.host}/browse?domain=${domainParam}`;
                    window.location.replace(newUrl)

                    clearBrowseItems();
                    activateAccountId(newAccount.id);
                    await loadAccountFeatures(newAccount.id);
                    this.setState({ redirecting: false });
                });
            }
        }

    }

    logUserIsOnline() {
        const { userId, isAdminImpersonatedSession } = this.props;
        const { accountId } = this.state;
        logUserIsOnline(
            accountId,
            userId,
            isAdminImpersonatedSession
        );
    }

    reconnectSafariToSocket() {
        const { accountId } = this.state;
        if (isIOSSafari() && accountId !== undefined) {
            APISubscribeToRoutingKeys([{
                type: RoutingKeyType.ACCOUNT,
                value: accountId,
            }]);
        }
    }

    unsubscribeFromNotificationService(accountId: string | undefined): void {
        if (accountId === null) {
            return;
        }
        APIUnsubscribeFromRoutingKeys([
            {
                type: RoutingKeyType.ACCOUNT,
                value: accountId || this.state.accountId,
            }
        ]);
    }

    loadUsersAndGroups(accountId: string): void {
        accountUsers(accountId);
        invalidateQuery(getAccountUsergroupsKey(accountId))
    }

    async monitorUncaughtErrors(evt) {
        logClientError(Application.EDITOR, evt);
        return false;
    }

    render() {
        if (this.state.hasError) {
            return (
                <ThemeProvider>
                    <ErrorFullPage {...this.state} />
                </ThemeProvider>
            );
        }
        return (
            <ThemeProvider>
                <ConnectionStateProvider>
                    <RedirectionNotifications>
                        <QueryClientProvider client={queryClient}>
                            <Ribbons>
                                <EditorDeployMonitor>
                                    <MyDetailsLoader />
                                    <RegularSessionCookieBannerWrapper />
                                    <EditLockingRedirection>
                                        <AcceptedTerms>
                                            <ClickHandlerContextProvider>
                                                <InactivityContextProvider>
                                                    <AbsolutePositioningContextProvider>
                                                        <WiredAutoLogoutHandler>
                                                            <DirtyStateContextProvider>
                                                                <VisualModalContextProvider>
                                                                    <LaunchDarklyFlagsProvider>
                                                                        <Trackers />
                                                                        <FlashMessages />
                                                                        {this.renderWebData(this.state.data)}
                                                                        <div className="ribbons">
                                                                            <IE11WarningBanner />
                                                                        </div>
                                                                    </LaunchDarklyFlagsProvider>
                                                                </VisualModalContextProvider>
                                                            </DirtyStateContextProvider>
                                                        </WiredAutoLogoutHandler>
                                                    </AbsolutePositioningContextProvider>
                                                </InactivityContextProvider>
                                            </ClickHandlerContextProvider>
                                        </AcceptedTerms>
                                    </EditLockingRedirection>
                                    <ReactQueryDevtools initialIsOpen={false} />
                                </EditorDeployMonitor>
                            </Ribbons>
                        </QueryClientProvider>
                    </RedirectionNotifications>
                </ConnectionStateProvider>
            </ThemeProvider >
        );
    }

    renderSuccess() {
        return (
            <>
                <AccountLogoFavicon />
                <Alerts userId={this.props.userId} />
                <div>{this.props.children}</div>
            </>
        );
    }

    renderFailure(error, incompleteData) {
        // eslint-disable-next-line no-console
        console.error("application component failed with", error);
        const { myAccounts } = incompleteData;
        const accountSwitchEnabled = myAccounts && myAccounts.length > 1;
        return (
            <FallbackComponent
                exception={this.props.t(TK.Account_DetailsFail)}
                accountSwitchEnabled={accountSwitchEnabled}
                accounts={accountSwitchEnabled && myAccounts}
            />
        );
    }
}

const AppContainer = Container.create(fixES5FluxContainer(App)) as React.ComponentType<React.PropsWithChildren<{ router: unknown }>>;
const AppContainerWithHooks = withHooks(AppContainer, () => ({
    reloadAccount: useReloadAccount(),
    queryDomain: useQueryParam(QUERY_PARAM_DOMAIN),
    accountId: useActiveAccountId(),
    userId: useCurrentUserId(),
    isAdminImpersonatedSession: useIsAdminImpersonatedSession(),
}));
export default withTranslation()(AppContainerWithHooks);
