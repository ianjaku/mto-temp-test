import { AncestorItems, Ancestors } from "@binders/client/lib/ancestors";
import { IItemsTransformerOptions, ItemsTransformer } from "@binders/binders-service-common/lib/itemstransformers";
import { IThumbnail, Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { AncestorBuilder } from "../ancestors/ancestorBuilder";
import { CollectionRepository } from "../repositories/collectionrepository";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ES_MAX_RESULTS } from "../const";
import { JWTSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import { MultiRepository } from "../repositories/multirepository";
import { UrlToken } from "@binders/binders-service-common/lib/tokens";
import { ensureVisualBehaviourProps } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { isPlaceholderVisual } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { splitEvery } from "ramda";

export interface InheritedThumbnailTransformerOptions extends IItemsTransformerOptions {
    ancestorBuilder?: AncestorBuilder;
}

export interface AncestorSummary {
    id: string;
    title: string;
}

export interface WithParentCollections {
    parentCollectionSummaries?: AncestorSummary[];
}

class InheritedThumbnailTransformer implements ItemsTransformer {

    constructor(
        private ancestorBuilder: AncestorBuilder,
        private collectionRepository: CollectionRepository,
        private jwtConfig: JWTSignConfig,
        private multiRepository: MultiRepository,
        private options: IItemsTransformerOptions = {},
    ) { }

    async items(items: Array<Item>): Promise<Item[]> {
        items = items.filter(i => !!i);
        if (!items) {
            return undefined;
        }
        if (!items.length) {
            return [];
        }

        const itemIds = items.map(item => item["binderId"] || item.id);
        const ancestors = await this.ancestorBuilder.getAncestors(itemIds);
        const ancestorCollections = await this.collectionRepository.findCollections(
            { ids: ancestors.keys() },
            { maxResults: ES_MAX_RESULTS },
        );
        if (this.options.directParentCollectionId) {
            // shared direct parent for items (typically in browsing)
            const collection = await this.findAncestorThumbnailFor(
                this.options.directParentCollectionId,
                ancestors,
                ancestorCollections,
            );
            const result = !collection || !collection.thumbnail ?
                items :
                await Promise.all(
                    items.map(item => this.toNormalizedWithThumbnail(item, ancestors, ancestorCollections, collection.thumbnail)),
                );
            return await this.addUrlToken(result);
        }

        // No shared direct parent for items (typically in searching)
        const result = await splitEvery(5, items).reduce(async (reducedPromise, itemsBatch) => {
            const reduced = await reducedPromise;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const normItems: any = await Promise.all(itemsBatch.map(item => this.toNormalizedWithThumbnail(item, ancestors, ancestorCollections)));

            return reduced.concat(normItems);
        }, Promise.resolve([]));
        const processedItems = await this.addUrlToken(result);
        return processedItems;

    }

    async findAncestorThumbnailFor(itemId: string, ancestors: Ancestors, ancestorCollections: DocumentCollection[], itemOverride?: Item): Promise<Item> { // itemId is either a binderId either a collectionId
        const item = itemOverride || await this.multiRepository.getBinderOrCollection(itemId);
        if (!isPlaceholderVisual(item.thumbnail.medium)) {
            return item;
        }

        let collection;
        const hasActualThumbnailCondition = async (collectionId: string) => {
            collection = ancestorCollections.find(c => c.id === collectionId);
            return collection && !isPlaceholderVisual(collection.thumbnail.medium);
        }

        await ancestors.findClosestParent([itemId], hasActualThumbnailCondition);
        return collection;
    }

    async addUrlToken(items: Item[]): Promise<Item[]> {
        const allIds: Set<string> = new Set();
        items.map(it => {
            const ancestorId = it.thumbnail["ancestorCollectionId"];
            if (ancestorId) {
                allIds.add(ancestorId);
            } else {
                const binderId = it["binderId"] || it.id;
                allIds.add(binderId);
            }
        });
        const urlTokens: { [key: string]: UrlToken } = await UrlToken.buildMany(Array.from(allIds), this.jwtConfig, 1);
        return items.map(it => {
            const ancestorId = it.thumbnail["ancestorCollectionId"];
            const binderId = it["binderId"] || it.id;
            const idToUse = ancestorId || binderId;
            const urlToken: string = urlTokens[idToUse] && urlTokens[idToUse].key;
            it.thumbnail.urlToken = urlToken;
            return it;
        })
    }

    getAncestorsList(ancestors: Ancestors, ancestorCollections: DocumentCollection[], binderId: string, result = []): DocumentCollection[] {
        const parent = ancestors.getItems()[binderId];
        if (!parent || parent.length === 0) {
            return result;
        }
        const parentCollection = ancestorCollections.find(({ id }) => id === parent[0].id)
        return this.getAncestorsList(ancestors, ancestorCollections, parent[0].id, [...result, parentCollection]);
    }

    getAllAncestorSummaries(ancestors: AncestorItems, ancestorCollections: DocumentCollection[], binderId: string): AncestorSummary[] {
        const result = [];
        this.takeAncestors(ancestors, binderId, [], 0, result);
        return result.map(([, ...r]) => r).map(r => {
            return r.reduce((acc, colId) => {
                const col = ancestorCollections.find(({ id }) => id === colId);
                if (!col) {
                    return acc;
                }
                return acc.concat({
                    id: col.id,
                    title: col.titles[0].title,
                });
            }, []).reverse();
        })
    }

    takeAncestors(ancestors: AncestorItems, id: string, path = [], index = 0, r: string[][]): void {
        path[index] = id;
        index++;
        if (ancestors[id].length === 0) {
            const result = [];
            for (let i = 0; i < index; i++) {
                result.push(path[i]);
            }
            r.push(result);
        } else {
            for (let i = 0; i < ancestors[id].length; i++) {
                this.takeAncestors(ancestors, ancestors[id][i].id, path, index, r);
            }
        }
        index--;
    }


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async toNormalizedWithThumbnail(item: Item, ancestors: Ancestors, ancestorCollections: DocumentCollection[], providedThumbnail?: IThumbnail): Promise<any> {
        const binderId = item["binderId"] || item.id;
        const parentCollectionSummaries = this.getAllAncestorSummaries(ancestors.getItems(), ancestorCollections, binderId);
        if (!isPlaceholderVisual(item.thumbnail.medium)) {
            return { ...item, parentCollectionSummaries };
        }
        const ancestorCollection = await this.findAncestorThumbnailFor(binderId, ancestors, ancestorCollections, item);

        const thumbnail = providedThumbnail || (ancestorCollection && ancestorCollection.thumbnail);
        return !ancestorCollection ?
            this.itemWithFallbackThumbnail(item) :
            {
                ...item,
                parentCollectionSummaries,
                ...(thumbnail ?
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    { thumbnail: { ...ensureVisualBehaviourProps(thumbnail as any), ancestorCollectionId: ancestorCollection.id } } :
                    { ancestorCollectionId: ancestorCollection.id })
            };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itemWithFallbackThumbnail(item: Item): any {
        return {
            ...item,
            thumbnail: {
                medium: DEFAULT_COVER_IMAGE,
                fitBehaviour: "fit",
                bgColor: "transparent",
            },
            urlToken: undefined,
        };
    }

}

export default InheritedThumbnailTransformer;