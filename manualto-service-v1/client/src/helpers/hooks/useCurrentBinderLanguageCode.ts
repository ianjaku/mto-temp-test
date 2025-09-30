import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useActiveViewable } from "../../stores/hooks/binder-hooks";

export const useCurrentBinderLanguageCode = (): string => {
    const activeViewable = useActiveViewable();
    if (!activeViewable) return null;
    const { languageCodeForPreview } = activeViewable;
    const { language } = activeViewable as Publication;
    return language ? language.iso639_1 : languageCodeForPreview;
}
