import * as React from "react";
import { DocumentCollection, Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IWebData, WebDataState } from "@binders/client/lib/webdata";
import { clearForceRedirectionRequest, useForceRedirectionRequest } from "../store";
import { useActiveCollection, useBrowsePathsWebData } from "../../browsing/hooks";
import { useHistory, useLocation } from "react-router";
import DocumentStore from "../../documents/store";
import { loadItemsInCollection } from "../../documents/actions";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
const { useEffect, useMemo } = React;

/**
 * Ensures that the forceRedirectionRequest from the item locks store is cleared immediately after it was set
 */
export function useClearRedirectionRequest(): void {
    const forceRedirectionRequest = useForceRedirectionRequest();
    useEffect(() => {
        if (forceRedirectionRequest) {
            clearForceRedirectionRequest();
        }
    }, [forceRedirectionRequest]);
}

export function useRedirectWhenLocked(): void {
    const history = useHistory();
    const { pathname } = useLocation();
    const forceRedirectionRequest = useForceRedirectionRequest();
    const activeCollectionId = useActiveCollection();
    const breadcrumbsPathsWD = useBrowsePathsWebData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editableItemsWD: IWebData<any> = useFluxStoreAsAny(DocumentStore, (_prevState, store) => store.getEditableItems());
    const breadcrumbsPaths = useMemo(() => breadcrumbsPathsWD.state === WebDataState.SUCCESS && breadcrumbsPathsWD.data, [breadcrumbsPathsWD]);
    const editableItems = useMemo(() => editableItemsWD.state === WebDataState.SUCCESS && editableItemsWD.data, [editableItemsWD]);

    const inComposer = useMemo(() => pathname.includes("/documents/"), [pathname]);

    useEffect(() => {
        if (!forceRedirectionRequest) {
            return;
        }
        const { targetItemId, redirectCollectionId, restrictRedirectionToComposer } = forceRedirectionRequest;
        if (!redirectCollectionId || (restrictRedirectionToComposer && !inComposer)) {
            return;
        }
        const pathContainItemCollectionId = (breadcrumbsPaths || []).some((path: DocumentCollection[]) => path.some(col => col.id === targetItemId));
        const editableItemsContainItemCollectionId = (editableItems || []).some((item: Item) => item.id === targetItemId);

        const shouldRedirect = pathContainItemCollectionId || editableItemsContainItemCollectionId;

        if (shouldRedirect) {
            let collectionIdToRedirectTo = redirectCollectionId;
            if (collectionIdToRedirectTo === "/") {
                collectionIdToRedirectTo = "";
            }
            if (collectionIdToRedirectTo === "..") {
                collectionIdToRedirectTo = activeCollectionId;
            }
            if (window.location.pathname === `/browse/${collectionIdToRedirectTo}`) {
                if (collectionIdToRedirectTo.length > 1) {
                    loadItemsInCollection(collectionIdToRedirectTo);
                }
                return;
            }
            if (collectionIdToRedirectTo) {
                history.push(`/browse/${collectionIdToRedirectTo}`);
            } else {
                if (window.location.pathname === "/browse") {
                    window.location.reload();
                } else {
                    history.push("/browse");
                }
            }
        }
    }, [breadcrumbsPaths, forceRedirectionRequest, history, activeCollectionId, inComposer, editableItems]);
}