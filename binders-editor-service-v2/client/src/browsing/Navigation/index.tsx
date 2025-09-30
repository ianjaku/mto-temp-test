import * as React from "react";
import {
    ACCOUNT_ANALYTICS_ROUTE,
    ANALYTICS_ROUTE,
    AnalyticsRouter
} from "../../analytics/routes";
import {
    Account,
    AccountFeatures,
    FEATURE_ANALYTICS,
    FEATURE_LIVECHAT,
    FEATURE_READONLY_EDITOR
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { BROWSE_ROUTE, MyLibraryRouter } from "../MyLibrary/routes";
import { COMPOSER_ROUTE, ComposerRouter } from "../../documents/Composer/routes";
import { HOME_PAGE_ROUTE, HomePageRouter } from "../../home/routes";
import { IWebData, WebData } from "@binders/client/lib/webdata";
import { MANUAL_FROM_VIDEO_ROUTE, ManualFromVideoRouter } from "../../manualfromvideo/routes";
import { Route, Switch } from "react-router-dom";
import { SEARCH_ROUTE, SearchRouter } from "../../documents/search/routes";
import { SETTINGS_ROUTE, SettingsRouter } from "../../accounts/AccountSettings/routes";
import { TRASH_ROUTE, TrashRouter } from "../../trash/routes";
import { USERS_ROUTE, UsersRouter } from "../../users/Users/routes";
import { User, UserDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { useCookieConsent, useEnableHubspotChatWidget } from "../../tracking/hooks";
import { useHasUserLoggedOff, useMyDetails } from "../../users/hooks";
import { useTranslation, withTranslation } from "@binders/client/lib/react/i18n";
import AccountsStore from "../../accounts/store";
import { Container } from "flux/utils";
import { CookieStatus } from "@binders/client/lib/util/cookie";
import FallbackComponent from "../../application/FallbackComponent";
import HeaderNavbar from "../HeaderNavbar";
import { HubspotWrapper } from "../../tracking/HubspotWrapper";
import Intercom from "@binders/ui-kit/lib/thirdparty/intercom";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import Loader from "@binders/ui-kit/lib/elements/loader/index";
import { ModalView } from "@binders/ui-kit/lib/compounds/modals/ModalView";
import { RouteComponentProps } from "react-router";
import { TFunction } from "i18next";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UiErrorCode } from "@binders/client/lib/errors";
import { WebDataComponent } from "@binders/ui-kit/lib/elements/webdata";
import { checkWebDataTransition } from "@binders/client/lib/webdata/helpers";
import { containsEditPermissions } from "../../authorization/helper";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { getLastUsedAccountIds } from "../../accounts/actions";
import { useIsAdminImpersonatedSession } from "../../stores/impersonation-store";
import { useIsHomePageEnabled } from "../../home/hooks";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useMyPermissionMap } from "../../authorization/hooks";
import { useSwitchInterfaceLanguageEffect } from "../../hooks/useSwitchInterfaceLanguageEffect";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";

const accountCmp = (left: Account, right: Account): number => {
    return left.name.toLowerCase().localeCompare(right.name.toLowerCase());
}

const sortAccounts = (accounts: Account[]): Account[] => {
    const lastUsed: string[] = getLastUsedAccountIds();
    lastUsed.reverse();
    const used: Account[] = [];
    const toSortAlphabetically = [...accounts];
    lastUsed.forEach(lastUsedId => {
        const lastUsedIndex = toSortAlphabetically.findIndex(a => a && a.id === lastUsedId)
        if (lastUsedIndex > -1) {
            used.push(toSortAlphabetically[lastUsedIndex]);
            delete toSortAlphabetically[lastUsedIndex];
        }
    })
    const sortedAlphabetically = toSortAlphabetically.sort(accountCmp);
    return used.concat(sortedAlphabetically);
}

type NavigationState = {
    data: IWebData<{
        accounts: Account[];
        accountFeatures: AccountFeatures;
        helpAccount: Account | undefined;
    }>;
    activeAccount: Account;
};

const SwitchInterfaceLanguageSideEffect = () => {
    useSwitchInterfaceLanguageEffect();
    return null;
}

type NavigationProps = RouteComponentProps & {
    cookieStatus;
    isHomePageEnabled: boolean;
    isHubspotChatWidgetEnabled: boolean;
    isUserLoggedOff: boolean;
    myUserDetails?: UserDetails;
    t: TFunction;
    isManualFromVideoFlagSet: boolean;
};

class Navigation extends WebDataComponent<NavigationState["data"], NavigationProps> {

    static getStores() {
        return [
            AccountsStore,
        ]
    }

    static calculateState(prevState: NavigationState) {
        const accountFeaturesWD = AccountsStore.getAccountFeatures();

        const data = WebData.compose({
            accounts: AccountsStore.myAccounts(),
            accountFeatures: accountFeaturesWD,
            helpAccount: AccountsStore.getHelpAccount(),
        });

        checkWebDataTransition("Navigation", prevState?.data, data);

        return {
            activeAccount: AccountsStore.getActiveAccount(),
            data,
        };
    }

    render() {
        return this.renderWebData(this.state.data, { loadingMessage: this.props.t(TK.Account_FetchingPermissionsAndAccounts) });
    }

    renderSuccess(data) {
        const { accountFeatures, accounts } = data;
        const isReadOnlyReader = accountFeatures.includes(FEATURE_READONLY_EDITOR);
        const { activeAccount } = this.state;
        const { myUserDetails } = this.props;
        const user = myUserDetails?.user;
        const sortedAccounts = isReadOnlyReader ? sortAccounts(accounts) : sortAccounts(accounts).filter(account => account.canIEdit);

        if (!activeAccount.accountIsNotExpired) {
            return (
                <UserHasEditPermissionsInAccount accounts={sortedAccounts} user={user}>
                    <FallbackComponent expired={true} accounts={sortedAccounts} accountSwitchEnabled={true} user={user} />
                </UserHasEditPermissionsInAccount>
            );
        }
        const navigation = this.renderNavigation(data);
        const featuresLivechat = accountFeatures.includes(FEATURE_LIVECHAT);
        const cookiesAllowed = this.props.cookieStatus === CookieStatus.Accepted;
        const enableLiveChat = featuresLivechat && cookiesAllowed;

        const intercomConfig = window.bindersConfig.intercom;
        const intercomAppId = intercomConfig && intercomConfig.appId;
        const enableIntercomChatWidget = !this.props.isHubspotChatWidgetEnabled && intercomAppId && enableLiveChat;
        const intercomUserHash = intercomConfig && intercomConfig.userHash;
        return (
            <UserHasEditPermissionsInAccount accounts={sortedAccounts} user={user}>
                {this.props.isHubspotChatWidgetEnabled && (
                    <>
                        <HubspotWrapper />
                        {navigation}
                    </>
                )}
                {enableIntercomChatWidget && (
                    <Intercom user={user} appId={intercomAppId} userHash={intercomUserHash}>{navigation}</Intercom>
                )}
                {!this.props.isHubspotChatWidgetEnabled && !enableIntercomChatWidget && navigation}
            </UserHasEditPermissionsInAccount>
        );
    }

    redirectIfUserLoggedOff() {
        const { isUserLoggedOff } = this.props;
        if (isUserLoggedOff) {
            window.location.href = `/logout?reason=${UiErrorCode.sessionEnd}`;
        }
    }

    renderNavigation(data) {
        const { accountFeatures, accounts, helpAccount } = data;
        const sortedAccounts = accountFeatures.includes(FEATURE_READONLY_EDITOR) ?
            sortAccounts(accounts) :
            sortAccounts(accounts).filter(account => account.canIEdit);
        const hasAnalyticsEnabled = accountFeatures.includes(FEATURE_ANALYTICS);
        const isTrashFeatureEnabled = true;

        return (
            <div>
                <SwitchInterfaceLanguageSideEffect />
                <ModalView>
                    {this.redirectIfUserLoggedOff()}
                    <HeaderNavbar
                        accounts={sortedAccounts}
                        accountFeatures={accountFeatures}
                        helpAccount={helpAccount}
                        hideAccountSwitcher={false}
                    >
                        <Switch>
                            {this.props.isHomePageEnabled &&
                                <Route path={HOME_PAGE_ROUTE} component={HomePageRouter} />
                            }
                            <Route path={BROWSE_ROUTE} component={MyLibraryRouter} />
                            <Route path={SEARCH_ROUTE} component={SearchRouter} />
                            <Route path={COMPOSER_ROUTE} component={ComposerRouter} />
                            <Route path={USERS_ROUTE} component={UsersRouter} />
                            <Route path={SETTINGS_ROUTE} component={SettingsRouter} />
                            <Route path={ACCOUNT_ANALYTICS_ROUTE} component={AnalyticsRouter} />
                            {hasAnalyticsEnabled &&
                                <Route path={ANALYTICS_ROUTE} component={AnalyticsRouter} />
                            }
                            {isTrashFeatureEnabled &&
                                <Route path={TRASH_ROUTE} component={TrashRouter} />
                            }
                            {this.props.isManualFromVideoFlagSet &&
                                <Route path={MANUAL_FROM_VIDEO_ROUTE} component={ManualFromVideoRouter} />
                            }
                        </Switch>
                    </HeaderNavbar>
                </ModalView>
            </div>
        )
    }

    renderFailure() {
        return <FallbackComponent exception={this.props.t(TK.Acl_CantLoadPermissions)} />
    }
}

const UserHasEditPermissionsInAccount: React.FC<{
    accounts: Account[];
    user: User;
}> = ({ accounts, user, children }) => {
    const { t } = useTranslation();
    const { data: permissions, isLoading, isError } = useMyPermissionMap();
    if (isLoading) {
        return <Loader text={t(TK.Account_FetchingPermissionsAndAccounts)} />;
    }
    if (isError) {
        return <FallbackComponent exception={t(TK.Acl_CantLoadPermissions)} />;
    }
    return containsEditPermissions(permissions) ?
        <>{children}</> :
        <FallbackComponent
            exception={t(TK.Account_NoPermissionsToEdit)}
            accounts={accounts}
            accountSwitchEnabled={true}
            user={user}
        />
}

const container = withTranslation()(Container.create(fixES5FluxContainer(Navigation)));
const containerWithHooks = withHooks(container, () => ({
    cookieStatus: useCookieConsent(),
    isHomePageEnabled: useIsHomePageEnabled(),
    isHubspotChatWidgetEnabled: useEnableHubspotChatWidget(),
    isAdminImpersonatedSession: useIsAdminImpersonatedSession(),
    myUserDetails: useMyDetails(),
    isUserLoggedOff: useHasUserLoggedOff(),
    isManualFromVideoFlagSet: useLaunchDarklyFlagValue(LDFlags.MANUAL_FROM_VIDEO),
}));
export default containerWithHooks;
