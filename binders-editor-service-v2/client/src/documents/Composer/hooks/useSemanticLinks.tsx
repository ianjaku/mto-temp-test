import DocumentStore from "../../store";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import { WebDataState } from "@binders/client/lib/webdata/index";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useMemo } from "react";

export const useSemanticLinks = (options = { excludeDeleted: false }): ISemanticLink[] => {
    const semanticLinks = useFluxStoreAsAny(
        DocumentStore,
        (_prevState, store) => {
            const semanticLinksWD = store.getSemanticLinks();
            return semanticLinksWD.state === WebDataState.SUCCESS ? semanticLinksWD.data : [];
        }
    );
    return useMemo(() => options.excludeDeleted ?
        semanticLinks.filter(semanticLink => !semanticLink.deleted) :
        semanticLinks
    , [semanticLinks, options.excludeDeleted]);
}