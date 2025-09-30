import * as React from "react";
import { Route, Switch } from "react-router-dom";
import Search from "./index";


export const SEARCH_ROUTE = "/search";

export const SearchRouter = () => (
    <Switch>
        <Route path={`${SEARCH_ROUTE}/:scopeCollectionId/:searchTerm`} component={Search} />
        <Route path={`${SEARCH_ROUTE}/:searchTerm`} component={Search} />
        <Route path={SEARCH_ROUTE} component={Search} />
    </Switch>
);