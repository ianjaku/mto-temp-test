import * as React from "react";
import { ACCOUNT_ANALYTICS_ROUTE, ANALYTICS_ROUTE } from "../analytics/routes";
import { Redirect, Route, Switch } from "react-router-dom";
import App from "../application";
import { BROWSE_ROUTE } from "../browsing/MyLibrary/routes";
import { COMPOSER_ROUTE } from "../documents/Composer/routes";
import FallbackComponent from "../application/FallbackComponent";
import { HOME_PAGE_ROUTE } from "../home/routes";
import { MANUAL_FROM_VIDEO_ROUTE } from "../manualfromvideo/routes";
import Navigation from "../browsing/Navigation";
import { SEARCH_ROUTE } from "../documents/search/routes";
import { SETTINGS_ROUTE } from "../accounts/AccountSettings/routes";
import { TRASH_ROUTE } from "../trash/routes";
import { USERS_ROUTE } from "../users/Users/routes";

export const AppRouter = props => (
    <App router={props}>
        <Switch>
            <Route path={USERS_ROUTE} component={Navigation} />
            <Route path={SETTINGS_ROUTE} component={Navigation} />
            <Route path={BROWSE_ROUTE} component={Navigation} />
            <Route path={COMPOSER_ROUTE} component={Navigation} />
            <Route path={SEARCH_ROUTE} component={Navigation} />
            <Route path={ANALYTICS_ROUTE} component={Navigation} />
            <Route path={ACCOUNT_ANALYTICS_ROUTE} component={Navigation} />
            <Route path={TRASH_ROUTE} component={Navigation} />
            <Route path={HOME_PAGE_ROUTE} component={Navigation} />
            <Route path={MANUAL_FROM_VIDEO_ROUTE} component={Navigation} />
            <Redirect from="/" to={BROWSE_ROUTE} exact />
            <Route path="*" component={(props) => <FallbackComponent {...props} notFound={true} />} />
        </Switch>
    </App>
);

export default AppRouter;
