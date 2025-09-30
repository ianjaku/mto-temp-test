import * as PropTypes from "prop-types";
import * as React from "react";
import {
    AccountFeatures,
    FEATURE_PUBLIC_API,
    FEATURE_TERMS_AND_CONDITIONS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    FaIconCloud,
    FaIconHome,
    FaIconLanguage,
    FaIconPrivacy,
    FaIconUser,
} from "@binders/client/lib/react/icons/font-awesome";
import { NavbarButton, NavbarSpacer } from "../../utils/navbar";
import { RouteComponentProps } from "react-router-dom";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { getImpersonationInfo } from "@binders/client/lib/util/impersonation";
import { toFullPath } from "../../util";
import { useTranslation } from "@binders/client/lib/react/i18n";

const NavigationBar: React.FC<{
    router: RouteComponentProps,
    collapsed: boolean,
    accountFeatures: AccountFeatures,
}> = ({ router, collapsed, accountFeatures }) => {
    const { t } = useTranslation();

    const impersonationInfo = getImpersonationInfo();
    const isDeviceUserTarget = impersonationInfo ? !!(impersonationInfo.isDeviceUserTarget) : undefined;

    return (<div>
        <NavbarButton
            collapsed={collapsed}
            icon={<FaIconHome />}
            title={t(TranslationKeys.General_Home)}
            onClick={() => go(toFullPath("/"), router)}
        />
        <NavbarSpacer />
        {isDeviceUserTarget === false && (
            <NavbarButton
                collapsed={collapsed}
                icon={<FaIconUser />}
                title={t(TranslationKeys.General_Preferences)}
                activeClass={getActiveClass(infoRoute, router)}
                onClick={() => go(infoRoute, router)}
            />
        )}
        <NavbarButton
            collapsed={collapsed}
            icon={<FaIconPrivacy />}
            title={t(TranslationKeys.General_Privacy)}
            activeClass={getActiveClass(privacyRoute, router)}
            onClick={() => go(privacyRoute, router)}
        />
        <NavbarButton
            collapsed={collapsed}
            icon={<FaIconLanguage />}
            title={t(TranslationKeys.General_Languages)}
            activeClass={getActiveClass(readerRoute, router)}
            onClick={() => go(readerRoute, router)}
        />
        {accountFeatures && accountFeatures.includes(FEATURE_TERMS_AND_CONDITIONS) && 
            <NavbarButton
                collapsed={collapsed}
                icon={<FaIconLanguage />}
                title={t(TranslationKeys.General_TermsTitle)}
                activeClass={getActiveClass(termsRoute, router)}
                onClick={() => go(termsRoute, router)}
            />
        }
        {accountFeatures?.includes(FEATURE_PUBLIC_API) && (
            <NavbarButton
                collapsed={collapsed}
                icon={<FaIconCloud />}
                title={t(TranslationKeys.User_PublicApi)}
                activeClass={getActiveClass(publicApiRoute, router)}
                onClick={() => go(publicApiRoute, router)}
            />
        )}
    </div>);
};

const isActive = (router: RouteComponentProps, route) => {
    const { location: { pathname }} = router;
    return pathname === route;
}

function getActiveClass(route: string, router: RouteComponentProps) {
    return isActive(router, route) ? "active" : "inactive";
}

function go(route: string, router: RouteComponentProps) {
    if (!isActive(router, route)) {
        router.history.push(route);
    }
}

export const infoRoute = toFullPath("/usersettings/info");
const privacyRoute = toFullPath("/usersettings/privacy");
const readerRoute = toFullPath("/usersettings/reader");
const termsRoute = toFullPath("/usersettings/terms-and-conditions");
const publicApiRoute = toFullPath("/usersettings/public-api");

NavigationBar.propTypes = {
    router: PropTypes.object.isRequired,
};

export default NavigationBar;
