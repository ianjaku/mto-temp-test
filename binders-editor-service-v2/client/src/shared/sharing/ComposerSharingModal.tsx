import * as React from "react";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { SharingModal } from "./SharingModal";
import { useMemo } from "react";
import { usePublishedUnpublishedLanguages } from "../../documents/Composer/hooks/usePublishedUnpublishedLangCodes";

export const ComposerSharingModal: React.FC<{
    binder: BinderClass;
    hide: () => void;
    initialLanguageCode?: string;
}> = ({ binder, hide, initialLanguageCode }) => {
    const { publishedLanguages } = usePublishedUnpublishedLanguages(binder);

    const titles = useMemo(
        () => binder.getLanguages().map(lang => ({ text: lang.storyTitle, iso639_1: lang.iso639_1 })),
        [binder]
    );

    return (
        <SharingModal
            availableLanguages={publishedLanguages}
            hasWarning={publishedLanguages.length === 0}
            hide={hide}
            initialLanguageCode={initialLanguageCode}
            itemId={binder.id}
            titles={titles}
            itemType="document"
        />
    )
}
