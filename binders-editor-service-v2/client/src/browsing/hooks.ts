import {
    BROWSE_COLLECTION_ROUTE,
    BROWSE_ROUTE,
    BROWSE_WILDCARD_COLLECTION_ROUTE,
    browseInfoFromRouteParams
} from "./MyLibrary/routes";
import type {
    DocumentCollection,
    EditorItem
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { activateAccountId, getDomainsForAccount } from "../accounts/actions";
import { useActiveAccount, useCurrentDomain } from "../accounts/hooks";
import { useHistory, useRouteMatch } from "react-router";
import { WebDataState } from "@binders/client/lib/webdata";
import { clearBrowseItems } from "../documents/actions";
import { getEditorLocation } from "@binders/client/lib/util/domains";
import { getWindowId } from "../notification/windowId";
import { isProduction } from "@binders/client/lib/util/environment";
import { stopImpersonation } from "@binders/client/lib/util/impersonation";
import { useBrowseStore } from "../stores/browse-store";
import { useCallback } from "react";
import { useIsImpersonatedSession } from "../stores/impersonation-store";

export function useActiveCollection() {
    return useBrowseStore((state) => state.activeCollection);
}

export function useActiveDocument() {
    return useBrowseStore((state) => state.activeDocument);
}

export function useActiveBrowsePathWebData() {
    return useBrowseStore((state) => state.activeBrowsePath);
}

export function useCollectionInfo() {
    return useBrowseStore((state) => state.collectionInfo);
}
export function useBindersAdditionalInfo() {
    return useBrowseStore((state) => state.bindersAdditionalInfo);
}

export function useBrowsePathsWebData() {
    return useBrowseStore((state) => state.browsePaths);
}

export function useActiveBrowsePathOrDefault(defVal?: EditorItem[]): EditorItem[] {
    const wd = useActiveBrowsePathWebData();
    return wd.state === WebDataState.SUCCESS ? wd.data : defVal;
}

export function useBrowsePathsOrDefault(defVal?: DocumentCollection[][]): DocumentCollection[][] {
    const wd = useBrowsePathsWebData();
    return wd.state === WebDataState.SUCCESS ? wd.data as DocumentCollection[][] : defVal;
}

export function useChecklistProgresses() {
    return useBrowseStore((state) => state.checklistProgresses);
}

export function useDocumentsPublicInfo() {
    return useBrowseStore((state) => state.documentsIsPublicInfo);
}

export function useActiveParentCollections() {
    return useBrowseStore((state) => state.activeParentCollections);
}

export function useIsTest() {
    return useBrowseStore((state) => state.isTest);
}

export function useLogout(): () => void {
    const activeAccount = useActiveAccount();
    const isImpersonatedSession = useIsImpersonatedSession();
    const logout = useCallback(() => {
        if (isImpersonatedSession) {
            stopImpersonation();
            return;
        }
        window.location.href = `/logout?accountId=${activeAccount.id}&windowId=${getWindowId()}`;
    }, [activeAccount, isImpersonatedSession]);
    return logout;
}

export function useSwitchAccount(): (accountId: string) => void {
    const currentDomain = useCurrentDomain();
    const history = useHistory();
    const switchAccount = useCallback(async (accountId: string) => {
        clearBrowseItems();
        const shouldSwitchUrl = isProduction();
        if (!shouldSwitchUrl) {
            activateAccountId(accountId);
        }
        const domains = await getDomainsForAccount(accountId);
        const domain = domains.find(domain => domain.length);
        if (domain && currentDomain !== domain && shouldSwitchUrl) {
            window.location.href = getEditorLocation(domain);
        } else {
            history.push(BROWSE_ROUTE);
        }
    }, [currentDomain, history]);
    return switchAccount;
}

export function useCollectionIdFromRoute() {
    const wildcardRouteMatch = useRouteMatch<{ collectionId?: string }>(BROWSE_WILDCARD_COLLECTION_ROUTE);
    const routeMatch = useRouteMatch<{ collectionId?: string }>(BROWSE_COLLECTION_ROUTE);
    return wildcardRouteMatch?.params.collectionId ?? routeMatch?.params.collectionId;
}

export function useCollectionRouteParams() {
    const wildcardRouteMatch = useRouteMatch<{ collectionId?: string }>(BROWSE_WILDCARD_COLLECTION_ROUTE);
    const routeMatch = useRouteMatch<{ collectionId?: string }>(BROWSE_COLLECTION_ROUTE);
    return browseInfoFromRouteParams(wildcardRouteMatch?.params ?? routeMatch?.params ?? {});
}
