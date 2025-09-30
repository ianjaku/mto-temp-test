import {
    BinderSearchResult,
    CollectionSearchResult,
    Item,
    ItemSearchHit,
    ItemSearchResult,
    PublicationSearchResult,
    isBinderHitType,
    isCollectionHitType, 
    isPublicationHitType
} from "@binders/client/lib/clients/repositoryservice/v3/contract";

export interface IItemsTransformerOptions {
    cdnnify?: boolean;
    directParentCollectionId?: string;
    thumbnailsOnly?: boolean;
    urlToken?: string;
}

export function multiTransformItems(items: Item[], itemsTransformers: ItemsTransformer[]): Promise<Item[]> {
    return itemsTransformers.reduce(async (reducedPromise, itemsTransformer) => {
        const itemsSoFar = await reducedPromise;
        return itemsTransformer.items(itemsSoFar);
    }, Promise.resolve(items));
}

export async function multiTransformSearchResult<S extends (BinderSearchResult | CollectionSearchResult | PublicationSearchResult | ItemSearchResult)> (
    searchResult: S,
    itemsTransformers: ItemsTransformer[]
): Promise<S> {
    const items = searchResult.hits.map(getItemFromSearchHit);

    let updatedItems = items;
    for (const itemsTransformer of itemsTransformers) {
        updatedItems = await itemsTransformer.items(updatedItems);
    }
    const updatedItemsMap = updatedItems.reduce((map, item) => map.set(item.id, item), new Map<string, Item>())

    const newHits: ItemSearchHit[] = [];
    for (const hit of searchResult.hits) {
        const itemAttributeKey = getSearchHitItemName(hit);
        const updatedItem = updatedItemsMap.get(hit[itemAttributeKey].id);
        if (updatedItem != null) {
            newHits.push({
                ...hit,
                [itemAttributeKey]: updatedItem
            });
        }
    }

    return {
        ...searchResult,
        hits: newHits,
        totalHitCount: newHits.length
    } as S;
}

export interface ItemsTransformer {
    items(items: Item[]): Promise<Item[]>;
}

const getSearchHitItemName = (searchHit: ItemSearchHit) => {
    if (isBinderHitType(searchHit)) return "binderSummary";
    if (isCollectionHitType(searchHit)) return "collection";
    if (isPublicationHitType(searchHit)) return "publicationSummary";
    throw new Error(`Unknown hit type: ${searchHit}`);
}

const getItemFromSearchHit = (
    searchHit: ItemSearchHit
): Item => {
    if (isBinderHitType(searchHit)) return searchHit.binderSummary;
    if (isCollectionHitType(searchHit)) return searchHit.collection;
    if (isPublicationHitType(searchHit)) return searchHit.publicationSummary;
    throw new Error(`Unknown hit type: ${searchHit}`);
}