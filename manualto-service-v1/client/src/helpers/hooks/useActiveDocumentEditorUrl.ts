import { QUERY_PARAM_DOMAIN, useQueryParam } from "@binders/client/lib/react/hooks/useQueryParams";
import { useActiveViewable, useAncestorsOfViewable } from "../../stores/hooks/binder-hooks";
import type { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { getAllPathsToRootCollection } from "@binders/client/lib/ancestors";
import { getEditorLocation } from "@binders/client/lib/util/domains";
import { getReaderDomain } from "../../util";
import { useCurrentBinderLanguageCode } from "./useCurrentBinderLanguageCode";
import { useMemo } from "react";

export function useActiveDocumentEditorUrl(props?: {
    linkToDefaultLanguage?: boolean;
}): string | null {
    const viewable = useActiveViewable();
    const ancestors = useAncestorsOfViewable();
    const editorLocation = getEditorLocation(getReaderDomain());
    const languageCode = useCurrentBinderLanguageCode();
    const queryDomain = useQueryParam(QUERY_PARAM_DOMAIN);

    const url = useMemo(() => {
        const publication = viewable as Publication;
        const allPaths = getAllPathsToRootCollection(publication.binderId, ancestors ?? {});
        const editorDocumentsPath = allPaths.at(0).join("/");
        const baseUrl = new URL(`${editorLocation}/documents/${editorDocumentsPath}`);
        if (queryDomain != null) {
            baseUrl.searchParams.append("domain", queryDomain);
        }
        if (languageCode && !props.linkToDefaultLanguage) {
            baseUrl.searchParams.append("langCode", languageCode);
        }
        return baseUrl.toString();
    }, [ancestors, editorLocation, languageCode, props.linkToDefaultLanguage, queryDomain, viewable])

    if (viewable.documentType !== "publication") {
        throw new Error(`Not a publication ${viewable.documentType}`)
    }

    return url;
}

