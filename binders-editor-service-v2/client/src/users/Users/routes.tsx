import * as React from "react";
import { Route, Switch } from "react-router-dom";
import Users from "./index";

export const USERS_ROUTE = "/users";

export const UsersRouter = () => (
    <Switch>
        <Route path={`${USERS_ROUTE}`} component={Users} />
    </Switch>
);