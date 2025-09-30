/* eslint-disable no-console */
import { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BackendImageServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { ElasticCollectionsRepository } from "../repositoryservice/repositories/collectionrepository";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { extractImageIdAndFormatFromUrl } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { isDev } from "@binders/client/lib/util/environment";

let fails = [] as string[][];
let successes = [] as string[];

function getOptions() {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <ID*> (*ID is either a itemId, 'all' or an accountID)`);
        process.exit(1);
    }
    return {
        id: process.argv[2],
    };
}
const configKey = "elasticsearch.clusters.binders";
const config = BindersConfig.get();
const elasticConfig = config.getObject(configKey);
if (elasticConfig.isNothing()) {
    console.error(`Missing ES client config: ${configKey}`);
    process.abort();
}
const logger = LoggerBuilder.fromConfig(config);
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

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

const isAzureUrl = (url: string) => url.match(/(images|images-production)\/\/(.*)\/img-/);
const takeBinderIdFromAzureUrl = (url: string) => {
    const match = url.match(/(images|images-production)\/\/(.*)\/img-/);
    if (match && match[2]) {
        return match[2].replace(/\//g, "");
    }
    return "";
}

const takeImageIdFromAzureUrl = (url: string) => {
    const match = url.match(/(images|images-production)\/\/(.*)\/(img-.*)\//);
    if (match[3]) {
        return match[3];
    }
    return "";
}

const updateBinderThumbnail = async (imageId, binder: Binder, repo) => {
    const { thumbnail, id } = binder;
    const newUrl = isDev() ? `http://dockerhost:30007/image/v1/binders/${id}/${imageId}/medium` : `https://api.binders.media/images/v1/binders/${id}/${imageId}/medium`;
    const newBinder = { ...binder, thumbnail: { ...thumbnail, medium: newUrl } };
    await repo.updateBinder(newBinder);
    process.stdout.write(".");
    return;
}

const updateCollectionThumbnail = async (imageId: string, collection: DocumentCollection, repo) => {
    const { thumbnail, id } = collection;
    const newMedium = isDev() ? `http://dockerhost:30007/image/v1/binders/${id}/${imageId}/medium` : `https://api.binders.media/images/v1/binders/${id}/${imageId}/medium`;
    const newCollection = { ...collection, thumbnail: { ...thumbnail, medium: newMedium } };
    await repo.updateCollection(newCollection);
    process.stdout.write(".");
}

const getImageServiceVisual = async (imageClient: ImageServiceClient, binderIdFromAzureUrl, imageIdFromAzureUrl, binderId) => {
    try {
        return await imageClient.getVisualByOriginalVisualData(binderIdFromAzureUrl, imageIdFromAzureUrl, binderId);
    } catch (err) {
        if (err.statusCode === 404) {
            return await imageClient.getVisual(binderId, imageIdFromAzureUrl);
        }
        throw err;
    }
}
const normalizeBindersScroll = (bindersRepo: ElasticBindersRepository, imageClient: ImageServiceClient) => {

    const upgradeBatch = async (batch: Binder[]) => {
        for (const binder of batch) {
            try {
                const isAzureThumbnail = isAzureUrl(binder.thumbnail.medium);
                const binderIdFromAzureUrl = isAzureThumbnail && takeBinderIdFromAzureUrl(binder.thumbnail.medium);
                const imageIdFromAzureUrl = isAzureThumbnail && takeImageIdFromAzureUrl(binder.thumbnail.medium);
                if (isAzureThumbnail && binderIdFromAzureUrl && binderIdFromAzureUrl !== binder.id) {
                    const newImage = await getImageServiceVisual(imageClient, binderIdFromAzureUrl, imageIdFromAzureUrl, binder.id);
                    console.log(`Found mismatch between thumbnail binderId and binder id - ${binderIdFromAzureUrl} vs ${binder.id}`);
                    if (!newImage || !newImage.id) {
                        console.error(`Couldn't find new image in mongo for originalBinderId - ${binderIdFromAzureUrl}, originalVisualId - ${imageIdFromAzureUrl}, binderId: ${binder.id}`)
                        return;
                    }
                    await updateBinderThumbnail(newImage.id, binder, bindersRepo);
                    successes.push(binder.id);
                }
            } catch (err) {
                fails.push([binder.id, err.message]);
            }
        }
    }

    const normalizeBatch = async (batch, i) => {
        console.log(`processing binders found in batch ${i}:`);
        await upgradeBatch(batch);
    };

    let i = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (esBatch: any[]) => {
        const batch = esBatch.map(itemFromESHit);
        await normalizeBatch(batch, i);
        i++;
    };
};

const normalizeCollectionsScroll = (collectionsRepo: ElasticCollectionsRepository, imageClient: ImageServiceClient) => {
    const upgradeBatch = async (batch: DocumentCollection[]) => {
        for (const collection of batch) {
            try {
                const { id, thumbnail: { medium } } = collection;
                if (!isAzureUrl(medium)) {
                    continue;
                }
                const binderIdFromAzureUrl = takeBinderIdFromAzureUrl(medium);
                const imageIdFromAzureUrl = takeImageIdFromAzureUrl(medium);
                if (binderIdFromAzureUrl && binderIdFromAzureUrl !== id) {
                    console.log(`Found mismatch between thumbnail binderId and binder id - ${binderIdFromAzureUrl} vs ${id}`);
                    let newImageId;
                    try {
                        const newImage = await imageClient.getVisualByOriginalVisualData(binderIdFromAzureUrl, imageIdFromAzureUrl, id);
                        if (!newImage || !newImage.id) {
                            throw new Error("not found");
                        }
                        newImageId = newImage.id;
                    } catch (err) {
                        console.log("Couldn't locate visual using the originalVisualData, looking at other formats in thumbnail");
                        for (const formatName of ["big", "huge", "thumbnail", "original", "bare", "medium", "medium2"]) {
                            const url = collection.thumbnail[formatName];
                            if (url && !isAzureUrl(url)) {
                                console.log(`Found one in ${formatName}`);
                                const [imageId] = extractImageIdAndFormatFromUrl(url);
                                newImageId = imageId;
                                break;
                            }
                        }
                    }
                    if (!newImageId) {
                        console.error(`Couldn't figure out a new image id for ${collection.id}`);
                    }
                    await updateCollectionThumbnail(newImageId, collection, collectionsRepo);
                    successes.push(collection.id);
                }
            } catch (err) {
                fails.push([collection.id, err.message]);
            }
        }
    }
    const normalizeBatch = async (batch, i) => {
        console.log(`processing binders found in batch ${i}:`);
        await upgradeBatch(batch);
    };

    let i = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (esBatch: any[]) => {
        const batch = esBatch.map(itemFromESHit);
        await normalizeBatch(batch, i);
        i++;
    };
};

const doIt = async () => {
    const binderRepo = new ElasticBindersRepository(config, logger, queryBuilderHelper);
    const collectionRepo = new ElasticCollectionsRepository(
        config,
        logger,
        queryBuilderHelper
    );
    const imageClient = await BackendImageServiceClient.fromConfig(config, "fix-duplicated-thumbanil-wrong-address");

    const normalizeBinders = async () => {
        const { id } = getOptions();
        let body;
        if (id.startsWith("aid-")) {
            body = { body: { query: { term: { "accountId": id } } } }
            console.log("processing for account", id)
        } else {
            if (id === "all") {
                console.log("processing all binders");
                body = { body: { query: { match_all: {} } } };
            } else {
                console.log("processing for binder", id);
                body = { body: { query: { term: { "_id": id } } } };
            }
        }
        const query = {
            index: binderRepo.getIndexName(),
            ...body
        };
        await binderRepo.runScroll(query, 600, 200, normalizeBindersScroll(binderRepo, imageClient));
    }
    const normalizeCollections = async () => {
        const { id } = getOptions();
        let body;
        if (id.startsWith("aid-")) {
            body = { body: { query: { term: { "accountId": id } } } }
            console.log("processing for account", id)
        } else {
            if (id === "all") {
                console.log("processing all collections");
                body = { body: { query: { match_all: {} } } };
            } else {
                console.log("processing for collection", id);
                body = { body: { query: { term: { "_id": id } } } };
            }
        }
        const query = {
            index: collectionRepo.getIndexName(),
            ...body
        };
        await collectionRepo.runScroll(query, 600, 200, normalizeCollectionsScroll(collectionRepo, imageClient));
    }



    console.log("------part 1: binders-----");
    await normalizeBinders();
    const binderResult = {
        successes: [...successes],
        fails: [...fails],
    };
    fails = [];
    successes = [];
    console.log("------part 2: collections-----");
    await normalizeCollections();
    const collectionResult = {
        successes: [...successes],
        fails: [...fails],
    };
    return {
        binderResult,
        collectionResult,
    }
};

doIt()
    .then((result) => {
        const { binderResult, collectionResult } = result;
        console.log("All done!");
        if (binderResult.successes.length) {
            console.log(`binder successes: ${binderResult.successes.join(",")}`);
        }
        if (binderResult.fails.length) {
            console.log("binder fails:");
            console.table(binderResult.fails);
        }
        if (collectionResult.successes.length) {
            console.log(`collection successes: ${collectionResult.successes.join(",")}`);
        }
        if (collectionResult.fails.length) {
            console.log("collection fails:");
            console.table(collectionResult.fails);
        }
        process.exit(0);
    },
    error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });