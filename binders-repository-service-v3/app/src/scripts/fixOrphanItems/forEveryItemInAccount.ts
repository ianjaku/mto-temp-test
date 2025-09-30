/**
* Scrolls through all items for an account
* making sure that it fetches all binders first
* and then fetches all collections ordered by creation date (DESC)
*
* Will scroll when there are more than 500 items, otherwise will just fetch.
*/
import {
    Binder,
    DocumentCollection
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../repositoryservice/repositories/binderrepository";
import {
    ElasticCollectionsRepository
} from  "../../repositoryservice/repositories/collectionrepository";
import { ElasticMultiRepository } from "../../repositoryservice/repositories/multirepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    RepositoryConfigType
} from  "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { getAllCollectionElementIds } from "./itemHelpers";
import { isCollection } from "@binders/client/lib/clients/repositoryservice/v3/helpers";

type ItemCallback = (item: (DocumentCollection | Binder)[]) => Promise<void>;

const parseEsHit = <T>(esHit: { _id: string, _source: T }): T => {
    return {
        id: esHit._id,
        ...esHit._source
    }
}

const parseQueryResult = <T>(esResult: { hits: { hits: { _id: string, _source: T }[] }}): T[] => {
    return esResult.hits.hits.map(parseEsHit);
}

const createBindersQuery = (accountId: string, indexName: string) => ({
    index: [indexName],
    body: {
        query: {
            term: { accountId }
        }
    },
    size: 10000
});

const createCollectionsQuery = (accountId: string, indexName: string) => ({
    index: indexName,
    body: {
        query: {
            term: { accountId }
        },
        sort: [
            { created: { order: "desc", missing: "_last" } }
        ]
    },
    size: 10000
});

const createChildrenFirst = (multiRepo: ElasticMultiRepository) => {
    const previousIds = new Set<string>();

    const childrenFirst = async (items: (Binder | DocumentCollection)[]): Promise<(Binder | DocumentCollection)[]> => {
        const resultItems = [];
        for (const item of items) {
            if (previousIds.has(item.id)) continue;
            if (!isCollection(item)) {
                throw new Error(`Item ${item.id} is not a collection, binders should not be passed to childrenFirst, something must've gone wrong`);
            }
            previousIds.add(item.id);

            const childIds = getAllCollectionElementIds(item, "collection");
            const newChildIds = childIds.filter(id => !previousIds.has(id));

            if (newChildIds.length > 0) {
                const children = await multiRepo.getItemsById(newChildIds);
                const childrenAndGrandChildren = await childrenFirst(children);
                resultItems.push(...childrenAndGrandChildren);
            }
            // We add the item itself after all the children have been added
            resultItems.push(item);
        }
        return resultItems;
    }
    return childrenFirst;
}

export const forEveryItemInAccount = async (
    accountId: string,
    callback: ItemCallback
): Promise<void> => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);
    const queryBuilderHelper = new DefaultESQueryBuilderHelper(config)
    const multiRepo = new ElasticMultiRepository(config, logger, queryBuilderHelper );
    const indexes = multiRepo.getIndexesNames([RepositoryConfigType.Binders, RepositoryConfigType.Collections])
    const bindersRepository = new ElasticBindersRepository(config, logger, queryBuilderHelper)
    const collectionRepository = new ElasticCollectionsRepository(config, logger, queryBuilderHelper)
    const bindersIndexName = bindersRepository.getIndexName()
    const collectionIndexName = collectionRepository.getIndexName()
    const childrenFirst = createChildrenFirst(multiRepo);

    const itemsInAccountCount = await multiRepo.runCount(indexes, { query: { term: { accountId } } });

    if (itemsInAccountCount < 1000) {
        const binders = await multiRepo.runQuery<Binder[]>(createBindersQuery(accountId, bindersIndexName), async r => parseQueryResult(r) );
        await callback(binders);
        const collections = await multiRepo.runQuery<DocumentCollection[]>(createCollectionsQuery(accountId, collectionIndexName), async r => parseQueryResult(r));
        const collectionsWithChildrenFirst = await childrenFirst(collections);
        await callback(collectionsWithChildrenFirst);
    } else {
        await multiRepo.runScroll<{ _source: Binder; _id: string }>(
            createBindersQuery(accountId, bindersIndexName),
            1000,
            200,
            (batch) => callback(batch.map(parseEsHit))
        );
        await multiRepo.runScroll<{ _source: DocumentCollection; _id: string }>(
            createCollectionsQuery(accountId, collectionIndexName),
            3600,
            200,
            async (batch) => {
                const collections = batch.map(parseEsHit);
                const collectionsWithChildrenFirst = await childrenFirst(collections);
                return callback(collectionsWithChildrenFirst);
            }
        );
    }
}