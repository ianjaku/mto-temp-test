import * as React from "react";
import { Route, Switch } from "react-router-dom";
import AccountAnalyticsViewer from "./AnalyticsViewers/AccountAnalyticsViewer";
import CollectionAnalyticsViewer from "./AnalyticsViewers/CollectionAnalyticsViewer";
import DocumentAnalyticsViewer from "./AnalyticsViewers/DocumentAnalyticsViewer";

export const ANALYTICS_ROUTE = "/analytics";

export const ACCOUNT_ANALYTICS_ROUTE = "/account-analytics"

const COLLECTION_ANALYTICS_ROUTE = `${ANALYTICS_ROUTE}/collection/:collectionId`;
const COLLECTION_ANALYTICS_ROUTE_WITH_PARENT_ROUTES = `${ANALYTICS_ROUTE}/collection/*/:collectionId`;
const DOCUMENT_ANALYTICS_ROUTE = `${ANALYTICS_ROUTE}/document/:documentId`;
const DOCUMENT_ANALYTICS_ROUTE_WITH_PARENT_ROUTES = `${ANALYTICS_ROUTE}/document/*/:documentId`;

export const AnalyticsRouter = () => (
    <Switch>
        <Route
            path={ACCOUNT_ANALYTICS_ROUTE}
            component={AccountAnalyticsViewer}
        />
        <Route
            path={COLLECTION_ANALYTICS_ROUTE_WITH_PARENT_ROUTES}
            component={CollectionAnalyticsViewer}
        />
        <Route
            path={COLLECTION_ANALYTICS_ROUTE}
            component={CollectionAnalyticsViewer}
        />
        <Route
            path={DOCUMENT_ANALYTICS_ROUTE_WITH_PARENT_ROUTES}
            component={DocumentAnalyticsViewer}
        />
        <Route
            path={DOCUMENT_ANALYTICS_ROUTE}
            component={DocumentAnalyticsViewer}
        />
    </Switch>
);

export const browseInfoFromRouteParams = routeParams => {
    const splat = routeParams[0];

    let paths;
    if (splat) {
        paths = splat.split("/");
    } else {
        paths = routeParams.collectionId ? [routeParams.collectionId] : [];
    }

    const currentCollection = paths[paths.length - 1];
    const parentCollections = paths.filter(path => path !== currentCollection);
    const currentDocument = routeParams.documentId || routeParams.collectionId;
    const isOnRootCollection = !routeParams.documentId && !routeParams.collectionId;
    return {
        parentCollections,
        currentCollection,
        currentDocument,
        isOnRootCollection,
    }
}
