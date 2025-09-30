import BinderClass, { LanguageWithInfo } from "@binders/client/lib/binders/custom/class";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import DocumentStore from "../../store";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useMemo } from "react";

type Language = Omit<LanguageWithInfo, "direction">;

export const usePublishedUnpublishedLanguages = (binder: BinderClass): {
    publishedLanguages: Language[];
    unpublishedLanguages: Language[];
} => {
    const activeBinderPublicationsWD: WebData<Publication[]> = useFluxStoreAsAny(
        DocumentStore,
        (_prevState, store) => store.getActiveBinderPublications()
    );
    const activeBinderPublications: Publication[] = useMemo(
        () => activeBinderPublicationsWD.state === WebDataState.SUCCESS ? activeBinderPublicationsWD.data : [],
        [activeBinderPublicationsWD],
    );
    if (!binder) {
        return {
            publishedLanguages: [],
            unpublishedLanguages: [],
        }
    }
    const [publishedLanguages, unpublishedLanguages] = binder.getVisibleLanguages().reduce((acc, l) => {
        const isPublished = activeBinderPublications.some(p => p.language.iso639_1 === l.iso639_1 && p.isActive);
        if (isPublished) {
            acc[0].push(l);
        } else {
            acc[1].push(l);
        }
        return acc;
    }, [[] as Language[], [] as Language[]]);
    return {
        publishedLanguages,
        unpublishedLanguages,
    }
}
