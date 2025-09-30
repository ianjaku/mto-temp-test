import {
    Binder,
    DocumentCollection,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IStoryWithTitle, ItemStory } from "../../binders/contract";
import { isPublicationItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { rewriteUrlIfProxy } from "../../util";

function extractTitle<T = unknown>(
    preferredLanguages: string[],
    titleInLanguageFinder: (langCode: string) => T,
    titleExtractor: (title: T) => string,
    defaultTitle: string,
): string {
    const candidate = preferredLanguages.reduce((reduced, languageCode) => {
        if (reduced !== undefined) {
            return reduced;
        }
        return titleInLanguageFinder(languageCode);
    }, undefined as T);
    if (candidate !== undefined) {
        return titleExtractor(candidate);
    }
    return defaultTitle;
}
function extractCollectionTitle(collection: DocumentCollection, preferredLanguages: string[]): string {
    return extractTitle(
        preferredLanguages,
        languageCode => collection.titles.filter(title => title.languageCode === languageCode)[0],
        collectionTitle => collectionTitle.title,
        collection.titles[0].title
    );
}

function extractItemTitle(item: ItemStory, preferredLanguages: string[]): string {
    if (item.kind === "collection" || ("isRootCollection" in item)) {
        return extractCollectionTitle(item as DocumentCollection, preferredLanguages);
    }
    return extractTitle(
        preferredLanguages,
        languageCode => item.languages.filter(language => language.iso639_1 === languageCode)[0],
        itemLanguage => itemLanguage.storyTitle,
        item.languages[0].storyTitle
    );
}

export function toStoryWithTitle(item: ItemStory, preferredLanguages: string[]): IStoryWithTitle {
    const title = extractItemTitle(item, preferredLanguages);
    return {
        kind: `${(item.kind === "collection" || "isRootCollection" in item) ? "collection" : ""}summary`,
        key: item.id,
        title,
        thumbnail: rewriteUrlIfProxy(item.thumbnail),
        original: item,
        isRootCollection: (item.kind === "collection" || "isRootCollection" in item) ?
            (item as DocumentCollection).isRootCollection :
            false,
    };
}

export function getBinderId(document: Binder | Publication): string {
    return isPublicationItem(document) ? document.binderId : document.id;
}