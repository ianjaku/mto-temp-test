/* eslint-disable no-console */
import * as elastic from "@elastic/elasticsearch";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { ElasticCollectionsRepository } from "../repositoryservice/repositories/collectionrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const configKey = "elasticsearch.clusters.binders";
const config = BindersConfig.get();
const elasticConfig = config.getObject(configKey);
if (elasticConfig.isNothing()) {
    console.error(`Missing ES client config: ${configKey}`);
    process.abort();
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const client = new elastic.Client(Object.assign({}, elasticConfig.get()));
const logger = LoggerBuilder.fromConfig(config);
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

const getBinderRepository = () => {
    return new ElasticBindersRepository(config, logger, queryBuilderHelper);
};

const getCollectionRepository = () => {
    return new ElasticCollectionsRepository(
        config, logger, queryBuilderHelper
    );
};

const getQuery = (indexName) => {
    const body = ({ query: { match_all: {} }});
    return {
        index: indexName,
        body
    };
};
const itemFromESHit = (esHit) => {
    const item = esHit["_source"];
    item.id = esHit["_id"];
    const type = esHit["_type"];
    const kind = {
        "collection": "collection",
        "collections": "collection",
        "document": "document",
        "binder": "document",
        "binders": "document",
        "publication": "publication",
    }[type];
    item.kind = kind || "";
    return item;
};

const RECYCLY_BIN_COLLECTION = "AV2ivIsh7xU0aRIt-78l";
const SIEMENS_COLLECTION_COPY = "AVqTtMtiWsBl3LBoWtk2";
const VOLVO_COLLECTION_COPY = "AV5Mv2KW7xU0aRIt-8WG";

const cleanAllWrongCollections = async (binder, collections, binderRepo) => {
    if (collections.length === 1 && collections[0].id === RECYCLY_BIN_COLLECTION) {
        console.log(`Adding ${binder.id} to the recycle bin account.`);
        binder.accountId = collections[0].accountId;
        await binderRepo.updateBinder(binder);
        return;
    }
    const siemensCollection = collections.find(col => (
        col.id === SIEMENS_COLLECTION_COPY ||
        col.id === VOLVO_COLLECTION_COPY
    ));
    if (siemensCollection) {
        console.log(`Adding ${binder.id} to the Binders Media account`);
        binder.accountId = siemensCollection.accountId;
        await binderRepo.updateBinder(binder);
        return;
    }
    console.log(`Not touching ${binder.id} ${collections.map(c => c.id)}`);
};

const cleanOrphan = async (bindersRepo, binder) => {
    console.log(`Deleting orphan ${binder.id}`);
    return bindersRepo.deleteBinder(binder);
};

const buildUpdateOperation = async (binder, allParentCollections, binderRepo) => {
    const binderParentCollections = allParentCollections
        .filter(col => !!col.elements.find(el => el.key === binder.id));
    if (binderParentCollections.length === 0) {
        console.log(`??? Binder ${binder.id} does not have any parent`);
        await cleanOrphan(binderRepo, binder);
        return undefined;
    }
    const wrongParentCollections = binderParentCollections
        .filter(col => col.accountId && col.accountId !== binder.accountId);
    if (wrongParentCollections.length === binderParentCollections.length) {
        console.log(`??? Binder ${binder.id} only belongs in wrong collections ${wrongParentCollections.map(c => c.id)}`);
        await cleanAllWrongCollections(binder, wrongParentCollections, binderRepo);
        return undefined;
    }
    if (wrongParentCollections.length > 0) {
        if (binder.accountId === undefined) {
            console.log("Skipping binder without accountId", binder.id);
            return undefined;
        }
        console.log(`Binder ${binder.id} exists in multiple accounts ${wrongParentCollections.map(c => c.id)}`);
        return {
            binderId: binder.id,
            collections: wrongParentCollections
        };
    }
    return undefined;
};

const cleanParentCollections = async (binderRepo, collectionRepo, binders) => {
    const binderIds = binders.map(b => b.id);
    const filter = {
        itemIds: binderIds
    };
    const parentCollections = await collectionRepo.findCollections(filter, { maxResults: 2000 }, []);
    const updateOperations =
        (
            await Promise.all(
                binders.map(binder => buildUpdateOperation(binder, parentCollections, binderRepo))
            )
        )
            .filter(op => !!op);
    await performUpdateOperations(collectionRepo, updateOperations);
};

const cleanCrossAccountItemBatch = (binderRepo, collectionRepo) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (esBatch: any[]) => {
        const batch = esBatch.map(itemFromESHit);
        await cleanParentCollections(binderRepo, collectionRepo, batch);
    };
};

const sequential = (items, f) => {
    return items.reduce( async (reduced, item) => {
        await reduced;
        await f(item);
    }, Promise.resolve(undefined));
};

const performUpdateOperations = async (collectionRepo, ops) => {
    const processOp = async op => {
        const { binderId, collections } = op;
        const updateCollection = async collection => {
            collection.elements = collection.elements.filter(e => e.key !== binderId);
            console.log(`Removing ${binderId} from ${collection.id}`);
            await collectionRepo.updateCollection(collection);
        };
        await sequential(collections, updateCollection);
    };
    await sequential(ops, processOp);
};

const doIt = async () => {
    const binderRepo = await getBinderRepository();
    const collectionRepo = await getCollectionRepository();
    const query = getQuery(binderRepo.getIndexName());
    console.log(query);
    await binderRepo.runScroll(query, 10, 200, cleanCrossAccountItemBatch(binderRepo, collectionRepo));
};

doIt()
    .then( () => {
        console.log("All done!");
        process.exit(0);
    },
    error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });