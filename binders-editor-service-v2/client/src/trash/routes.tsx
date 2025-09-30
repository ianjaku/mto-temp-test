
import * as React from "react";
import { Route, Switch } from "react-router-dom";
import RestoreDeletedItemsView from "./RestoreDeletedItemsView";

export const TRASH_ROUTE = "/recycleBin"

const COLLECTION_TRASH_ROUTE = `${TRASH_ROUTE}/:scopeCollectionId`;

export const TrashRouter = () =>(<Switch>
    <Route
        path={COLLECTION_TRASH_ROUTE}
        component={RestoreDeletedItemsView}
    />
    <Route
        path={TRASH_ROUTE}
        component={RestoreDeletedItemsView}
    />
</Switch>);

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
    return {
        parentCollections,
        currentCollection,
        currentDocument
    }
}