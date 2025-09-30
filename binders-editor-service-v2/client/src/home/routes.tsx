
import * as React from "react";
import { Route, Switch } from "react-router-dom";
import { HomePage } from "./HomePage";

export const HOME_PAGE_ROUTE = "/home"

export const HomePageRouter = () => (
    <Switch>
        <Route
            path={HOME_PAGE_ROUTE}
            component={HomePage}
        />
    </Switch>
);

export const browseInfoFromRouteParams = (_routeParams: unknown) => {
    return {
        parentCollections: [],
        currentCollection: undefined,
        currentDocument: undefined,
    }
}
