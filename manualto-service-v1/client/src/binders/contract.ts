import {
    DocumentCollection,
    IBinderStory,
    PublicationSummary,
    ReaderItemSearchResult
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";

export interface IReaderItemsWithInfo {
    items: Array<IBinderStory | ICollectionStory>;
    languagesUsed: string[];
    accountHasPublications: boolean
}

// Used by the reader, a Story with title
export interface IStoryWithTitle {
    kind: "document" | "summary" | "collection" | "collectionsummary",
    key: string,
    title: string,
    thumbnail: Thumbnail,
    original: ItemStory,
    isRootCollection?: boolean,
}

export type ICollectionStory = DocumentCollection;
export type ItemStory = (IBinderStory | ICollectionStory) & { kind: string };
export function isBinderStory(item: ItemStory): item is IBinderStory & { kind: string } {
    return item.kind === "document" || item.kind === "summary";
}

// Used by the reader as a view type to populate the browser view
export type StoryTile = IStoryWithTitle & {
    icon: string;
    title: string;
    languageCode: string;
};

export type ReaderItemSearchResultClient = ReaderItemSearchResult & {
    query?: string;
}

export interface PublicationSearchHitClient {
    publicationSummary: PublicationSummary;
    fieldHits: IFieldSearchHitsClient[];
}

export interface CollectionSearchHitClient {
    collection: DocumentCollection;
    fieldHits: IFieldSearchHitsClient[];
}

export interface IFieldSearchHitsClient {
    field: string;
    contexts: IClientContext[];
    languageCode?: string;
}

export interface IClientContext {
    html: string;
    text: string;
}
