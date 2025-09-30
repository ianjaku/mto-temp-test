import * as PropTypes from "prop-types";
import * as React from "react";
import { Route, RouteComponentProps } from "react-router-dom";
import { PrivacySettings } from "../views/usersettings/privacy.lazy";
import { PublicApiSettings } from "../views/usersettings/publicapi.lazy";
import ReaderPreferences from "../views/usersettings/readerpreferences.lazy";
import TermsAndConditions from "../views/usersettings/termsAndConditions.lazy";
import UserInfoPane from "../views/usersettings/userinfo.lazy";
import UserSettingsPage from "../views/usersettings/page";
import { isDeviceTargetUserImpersonation } from "@binders/client/lib/util/impersonation";

const ROUTES = [
    {
        endpoint: "/info",
        component: UserInfoPane,
    },
    {
        endpoint: "/privacy",
        component: PrivacySettings,
    },
    {
        endpoint: "/reader",
        component: ReaderPreferences,
    },
    {
        endpoint: "/terms-and-conditions",
        component: TermsAndConditions,
    }
];

if (!isDeviceTargetUserImpersonation()) {
    ROUTES.push({
        endpoint: "/public-api",
        component: PublicApiSettings
    });
}

const UserSettingsRoutes: React.FC<{ path: string }> = ({ path }) =>
    <Route path={path} component={RenderSettings} />;

UserSettingsRoutes.propTypes = {
    path: PropTypes.string.isRequired,
};

const RenderSettings: React.FC<RouteComponentProps> = (props) => (
    <UserSettingsPage router={props}>
        {renderChild(props)}
    </UserSettingsPage>
);

const renderChild = <T extends RouteComponentProps>(props: T) => {
    const { isExact, url: rawUrl } = props.match;
    const url = rawUrl.indexOf("?") > 0 ? rawUrl.split("?")[0] : rawUrl;
    const { pathname } = props.location;
    const route = ROUTES.find(({ endpoint }) => {
        return isExact ? url.endsWith(endpoint) : pathname === `${url}${endpoint}`;
    });
    if (!route) {
        return <div />;
    }
    const Component = route.component as React.FC<{ router: T }>;
    return Component && <Component router={props} />;
};

export default UserSettingsRoutes;
