import * as React from "react";
import {
    Binder,
    DocumentCollection,
    PublicationSummary,
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ILanguageInfo, getLanguageInfo } from "@binders/client/lib/languages/helper";
import { SharingModal } from "./SharingModal";
import { isCollectionItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { useBinderPublicationSummaries } from "../../documents/Composer/components/HistoryPane/hooks";
import { useMemo } from "react";

const useItemAvailableLanguages = (item: DocumentCollection | Binder, publications: PublicationSummary[]): ILanguageInfo[] => {
    if (isCollectionItem(item)) {
        return item.titles
            .map(title => getLanguageInfo(title.languageCode));
    } else {
        const activePublicationsLanguageCodes = new Set(publications
            .filter(publication => publication.isActive)
            .map(publication => publication.language.iso639_1)
        );
        return item.languages
            .map(language => language.iso639_1)
            .filter(languageCode => activePublicationsLanguageCodes.has(languageCode))
            .map((languageCode) => getLanguageInfo(languageCode));
    }
}

interface Props {
    hide: () => void;
    item: DocumentCollection | Binder;
}

export const BrowseSharingModal: React.FC<Props> = ({ item, hide }) => {
    const binderId = isCollectionItem(item) ? undefined : item.id;
    const { data: publications = [] } = useBinderPublicationSummaries(binderId, false);
    const availableLanguages = useItemAvailableLanguages(item, publications);

    const titles = useMemo(() => {
        return isCollectionItem(item) ?
            item.titles.map(title => ({ text: title.title, iso639_1: title.languageCode })) :
            item.languages.map(lang => ({ text: lang.storyTitle, iso639_1: lang.iso639_1 }));
    }, [item]);

    const itemType = useMemo(() => {
        return isCollectionItem(item) ? "collection" : "document";
    }, [item]);

    const hasWarning = isCollectionItem(item) ?
        !item.hasPublications :
        publications.length === 0;

    return (
        <SharingModal
            availableLanguages={availableLanguages}
            hasWarning={hasWarning}
            hide={hide}
            itemId={item.id}
            itemType={itemType}
            titles={titles}
        />
    )
}
