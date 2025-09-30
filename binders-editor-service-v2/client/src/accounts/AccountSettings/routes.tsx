import * as React from "react";
import { Route, Switch } from "react-router-dom";
import AccountSettings from "./index";
import RestrictedToAccountAdmin from "../../shared/RestrictedToAccountAdmin";

export const SETTINGS_ROUTE = "/preferences";

export const SettingsRouter = () => (
    <Switch>
        <RestrictedToAccountAdmin>
            <Route exact path={`${SETTINGS_ROUTE}`} component={AccountSettings} />
        </RestrictedToAccountAdmin>
    </Switch>
);