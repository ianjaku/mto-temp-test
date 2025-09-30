import {
    ActiveParentCollection,
    useBinderStoreState,
    useActiveViewable as useStoreActiveViewable
} from "../zustand/binder-store";
import {
    Binder,
    DocumentAncestors,
    DocumentCollection,
    Publication,
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useEffect, useRef, useState } from "react";
import { APIContainsPublicAcl } from "../../api/authorizationService";
import { loadBrowseContext } from "../../views/browsing/helpers";
import { useActiveAccountId } from "./account-hooks";
import { useQuery } from "@tanstack/react-query";

export const useHasNewerPublication = (): boolean => {
    const newerPublication = useBinderStoreState(state => state.newerPublication);
    return !!newerPublication;
}

export const useActiveViewable = useStoreActiveViewable;

export const useActiveLanguageCode = (): string | null => {
    const selectedLanguage = useBinderStoreState(state => state.selectedLanguage);
    return selectedLanguage ?? null;
}

export const useActiveLanguageCodeForPreview = (): string | null => {
    const activeDocumentLanguageCodeForPreview = useBinderStoreState(state => state.activeDocumentLanguageCodeForPreview);
    return activeDocumentLanguageCodeForPreview ?? null;
}

export const useAncestorsOfViewable = (): DocumentAncestors | null => {
    const ancestorsOfViewable = useBinderStoreState(state => state.ancestorsOfViewable);
    return ancestorsOfViewable ?? null;
}

export const useIsPublicViewable = (): boolean | undefined => {
    const viewable = useActiveViewable() as Publication;
    const accountId = useActiveAccountId();
    const ancestors = useAncestorsOfViewable();
    const { data: isPublic } = useQuery({
        queryFn: async () => {
            return APIContainsPublicAcl(Object.keys(ancestors), accountId);
        },
        queryKey: ["isPublic", viewable?.id],
        enabled: !!ancestors,
    });
    return isPublic;
}

export function useActiveViewableTitle() {
    const activeViewable = useActiveViewable();
    const activeBinder = activeViewable as Binder;
    const activePublication = activeViewable as Publication;
    return activeViewable.documentType === "publication" ?
        activePublication.language.storyTitle :
        activeBinder.languages.find(lang => lang.iso639_1 === activeViewable.languageCodeForPreview)?.storyTitle;
}

export const useActiveParentCollection = (): ActiveParentCollection => {
    const activeParentCollection = useBinderStoreState(state => state.activeParentCollection);
    return activeParentCollection;
}

export const useParentPath = (): string[] => {
    const parentPath = useBinderStoreState(state => state.parentPath);
    return parentPath;
}

export const useParentTitle = (): string | undefined => {
    const parentTitle = useBinderStoreState(state => state.parentTitle);
    return parentTitle;
}

export const useCommentsEnabled = (): boolean | undefined => {
    const commentsEnabled = useBinderStoreState(state => state.commentsEnabled);
    return commentsEnabled;
}

export const useReadConfirmationEnabled = (): boolean | undefined => {
    const readConfirmationEnabled = useBinderStoreState(state => state.readConfirmationEnabled);
    return readConfirmationEnabled;
}

export const useBrowsePath = (): Array<Binder | DocumentCollection | string> | undefined => {
    const accountId = useActiveAccountId();
    const { activeCollectionInfo, readableItemsPermissions, parentPath } = useBinderStoreState(state => ({
        activeCollectionInfo: state.activeCollectionInfo,
        readableItemsPermissions: state.readableItemsPermissions,
        parentPath: state.parentPath,
    }));
    const [browsePath, setBrowsePath] = useState<Array<Binder | DocumentCollection | string> | undefined>();

    // Track request ID to prevent race conditions when dependencies change rapidly.
    // Only the result from the most recent request should be used, even if older requests complete later.
    // This prevents breadcrumbs showing a stale state when navigating upward in browse view
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!parentPath || !readableItemsPermissions) {
            return;
        }

        const currentRequestId = ++requestIdRef.current;

        const browseInfo = {
            parentCollections: parentPath,
            currentCollection: activeCollectionInfo?.id,
        };
        loadBrowseContext(browseInfo, readableItemsPermissions, accountId).then(browsePath => {
            // Only set the browsePath if this is still the latest request
            if (requestIdRef.current === currentRequestId) {
                setBrowsePath(browsePath);
            }
        })
    }, [accountId, activeCollectionInfo, parentPath, readableItemsPermissions]);

    return browsePath;
}