import * as React from "react";
import {
    dispatchLoadingItem,
    findAndActivatePublication,
    loadAndActivateBinder,
    loadAndActivatePublication,
    loadParentPathContext
} from "../binders/binder-loader";
import { AccountStoreGetters } from "../stores/zustand/account-store";
import { FEATURE_READER_RATING } from "@binders/client/lib/clients/accountservice/v1/contract";
import Reader from "../views/reader/reader.lazy";
import type { RouteComponentProps } from "react-router-dom";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import { handleContentLoadingError } from "../binders/loader";
import { logDocumentOpened } from "./tsHelpers";
import { resolveAdditionalChunks } from "../utils/additionalChunks";
import { useBinderStoreState } from "../stores/zustand/binder-store";
import { useCurrentUserPreferences } from "../stores/hooks/user-hooks";
import { useQuery } from "@tanstack/react-query";

export const ReaderRouter: React.FC<{
    accountIds: string[];
    loadFn: (router: RouteComponentProps, langs: string[], accountIds: string[]) => Promise<void>;
    router: RouteComponentProps;
}> = ({ accountIds, loadFn, router }) => {
    const readerLanguages = useCurrentUserPreferences().readerLanguages;
    const clientSelectedLanguage = useBinderStoreState(state => state.selectedLanguage);

    useQuery({
        queryFn: async () => {
            await loadFn(
                router,
                clientSelectedLanguage ?
                    [clientSelectedLanguage, ...readerLanguages] :
                    readerLanguages,
                accountIds,
            );
            return true;
        },
        queryKey: [router.match.path, router.match.url],
    });
    return (
        <Reader router={router} />
    );
}

export const loadRead = async (router: RouteComponentProps, _preferredLanguages: string[], accountIds: string[]): Promise<void> => {
    const publicationId = router.match.params["publicationId"] as string;
    const lang = getQueryStringVariable("lang");
    const languageCodes = lang ? [lang] : undefined;
    const accountFeatures = AccountStoreGetters.getAccountFeatures();
    const additionalChunks = resolveAdditionalChunks(accountFeatures, accountFeatures.includes(FEATURE_READER_RATING));
    const publication = await loadAndActivatePublication(
        publicationId,
        languageCodes,
        additionalChunks,
    );
    dispatchLoadingItem(publication.binderId);

    const parentPathContext = await loadParentPathContext(accountIds, publication.binderId, lang, {
        triggerParentCollectionActivate: true,
    });
    logDocumentOpened(publication, parentPathContext, accountIds[0], router.location.pathname);
}

export const loadPreview = async (router: RouteComponentProps, _preferredLanguages: string[], accountIds: string[]): Promise<void> => {
    const lang = getQueryStringVariable("lang");
    const binderId = router.match.params["binderId"] as string;

    dispatchLoadingItem(binderId);

    const parentPathContext = await loadParentPathContext(accountIds, binderId, lang, {
        triggerParentCollectionActivate: true,
    });
    const accountFeatures = AccountStoreGetters.getAccountFeatures();
    const additionalChunks = resolveAdditionalChunks(
        accountFeatures,
        parentPathContext?.ratingEnabled,
        parentPathContext?.readConfirmationEnabled,
    );
    loadAndActivateBinder(binderId, lang, additionalChunks);
};

export const loadLaunch = async (router: RouteComponentProps, preferredLanguages: string[], accountIds: string[]): Promise<void> => {
    const binderId = router.match.params["binderId"] as string;
    const languageCode = getQueryStringVariable("lang") || preferredLanguages[0];

    dispatchLoadingItem(binderId);

    try {
        const parentPathContext = await loadParentPathContext(accountIds, binderId, languageCode, {
            triggerParentCollectionActivate: true,
            rethrowError: true,
        });
        const accountFeatures = AccountStoreGetters.getAccountFeatures();
        const additionalChunks = resolveAdditionalChunks(
            accountFeatures,
            parentPathContext?.ratingEnabled,
            parentPathContext?.readConfirmationEnabled,
        );

        const publication = await findAndActivatePublication(
            router,
            binderId,
            languageCode,
            additionalChunks,
            { rethrowError: true }
        );
        logDocumentOpened(publication, parentPathContext, accountIds[0], router.location.pathname);
    } catch (error) {
        handleContentLoadingError(error);
        throw error;
    }
};

