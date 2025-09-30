/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { ElasticPublicationsRepository } from "../repositoryservice/repositories/publicationrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const configKey = "elasticsearch.clusters.binders";
const config = BindersConfig.get();
const elasticConfig = config.getObject(configKey);
if (elasticConfig.isNothing()) {
    console.error(`Missing ES client config: ${configKey}`);
    process.abort();
}
const logger = LoggerBuilder.fromConfig(config);
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

const getBinderRepository = () => {
    return new ElasticBindersRepository(config, logger, queryBuilderHelper);
};

const getPublicationRepository = () => {
    return new ElasticPublicationsRepository(config, logger, queryBuilderHelper);
};

const getBindersQuery = (indexName) => {
    const body = ({ query: { match_all: {} } });
    return {
        index: indexName,
        body
    };
};

const getPublicationsQuery = (indexName) => {
    const body = ({ query: { term: { isActive: true } } });
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

const results = { "binders": {}, "publications": {} };

const addToResults = (documentKind: string, id: string, accountId: string) => {
    if (!(accountId in results[documentKind])) {
        results[documentKind][accountId] = [];
    }
    results[documentKind][accountId].push(id);
}

const detectOutdatedBinders = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const detectOutdatedInBatch = async (batch, i) => {
        const outdatedVisualBinders = batch.reduce((reduced, binder) => {
            const { modules: { images: { chunked } } } = binder;
            const [{ chunks }] = chunked;
            const outdatedVisualsDetected = chunks.some(imgArr => imgArr.some(img => !img.url || !img.id));
            if (outdatedVisualsDetected) {
                reduced.push(binder);
            }
            return reduced;
        }, []);
        if (outdatedVisualBinders.length) {
            outdatedVisualBinders.forEach(({ id, accountId }) => addToResults("binders", id, accountId));
        }
    };
    let i = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (esBatch: any[]) => {
        const batch = esBatch.map(itemFromESHit);
        await detectOutdatedInBatch(batch, i);
        i++;
    };
};

const detectOutdatedCollections = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const detectOutdatedInBatch = async (batch, i) => {
        const outdatedVisualPublications = batch.reduce((reduced, publication) => {
            const { modules: { images: { chunked } } } = publication;
            const [{ chunks }] = chunked;
            const outdatedVisualsDetected = chunks.some(imgArr => imgArr.some(img => !img.url || !img.id));
            if (outdatedVisualsDetected) {
                reduced.push(publication);
            }
            return reduced;
        }, []);
        if (outdatedVisualPublications.length) {
            outdatedVisualPublications.forEach(({ id, accountId }) => addToResults("publications", id, accountId));
        }
    };
    let i = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (esBatch: any[]) => {
        const batch = esBatch.map(itemFromESHit);
        await detectOutdatedInBatch(batch, i);
        i++;
    };
};

const doIt = async () => {
    const binderRepo = await getBinderRepository();
    const allBindersQuery = getBindersQuery(binderRepo.getIndexName());
    await binderRepo.runScroll(allBindersQuery, 10, 200, detectOutdatedBinders());

    const publicationRepo = await getPublicationRepository();
    const activePublicationsQuery = getPublicationsQuery(publicationRepo.getIndexName());
    await publicationRepo.runScroll(activePublicationsQuery, 60, 200, detectOutdatedCollections());
};

doIt()
    .then(() => {
        console.log("Outdated visuals:", JSON.stringify(results, undefined, 2));
        process.exit(0);
    },
    error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });