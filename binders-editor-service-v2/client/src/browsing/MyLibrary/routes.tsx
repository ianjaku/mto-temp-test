import * as React from "react";
import { Route, Switch } from "react-router-dom";
import { MyLibraryPage } from "./MyLibraryPage";
import { RootCollectionProvider } from "./root/RootCollectionProvider";

export const BROWSE_ROUTE = "/browse";
export const BROWSE_WILDCARD_COLLECTION_ROUTE = `${BROWSE_ROUTE}/*/:collectionId`;
export const BROWSE_COLLECTION_ROUTE = `${BROWSE_ROUTE}/:collectionId`;

export type BrowseInfoFn = (
    routeParams: Record<string | number, string>,
) => BrowseInfo;

export type BrowseInfo = {
    parentCollections: string[];
    currentCollection?: string;
    currentDocument?: string;
}

export const browseInfoFromRouteParams: BrowseInfoFn = routeParams => {
    const splat = routeParams[0];
    const parentCollections = splat ? splat.split("/") : [];
    const currentCollection = routeParams.collectionId;
    const currentDocument = routeParams.binderId;
    return {
        parentCollections,
        currentCollection,
        currentDocument,
    }
}

export const MyLibraryRouter = () => (
    <>
        <Switch>
            <Route path={BROWSE_WILDCARD_COLLECTION_ROUTE} component={MyLibraryPage} />
            <Route path={BROWSE_COLLECTION_ROUTE} component={MyLibraryPage} />
            <RootCollectionProvider>
                <Route path={BROWSE_ROUTE} component={MyLibraryPage} />
            </RootCollectionProvider>
        </Switch>
    </>
);
