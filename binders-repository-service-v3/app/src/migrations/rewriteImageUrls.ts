/* eslint-disable no-console */
import { BackendRoutingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticCollectionsRepository } from "../repositoryservice/repositories/collectionrepository";
import { ElasticMigrator } from "../migrations/migration";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const collectionIndexName = "binders_collections_v2";
const binderIndexName =  "binders_binders-v2";
const publicationIndexName =  "publications";

const coverDefault = "http://placehold.it/300x300";
const coverDefaultNewOne = "https://s3-eu-west-1.amazonaws.com/manualto-images/document-cover-default.png";

const oldMediaApiUrl = new RegExp("http://api.binders.media/images/v1/");
const newMediaApiUrl = "https://api.binders.media/images/v1/";

const collectionRepository = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
const publicationRepository = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
const binderRepository = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));

const collectionMigration = new ElasticMigrator(collectionRepository, collectionRepository);
const publicationMigration = new ElasticMigrator(publicationRepository, publicationRepository);
const binderMigration = new ElasticMigrator(binderRepository, binderRepository);

const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: ${__filename} <URL_OLD_PATTERN> <URL_NEW_PATTERN>`);
        process.exit(1);
    }
    return {
        oldUrlParam: process.argv[2],
        newUrlParam: process.argv[3]
    };
};

const { oldUrlParam, newUrlParam : urlNewOne } = getOptions();
const urlRegex = new RegExp(oldUrlParam);


const collectionQuery = {
    index: collectionIndexName,
    body: {
        query: { match_all: {} }
    }
};
const publicationQuery = {
    index: publicationIndexName,
    body: {
        query: { match_all: {} }
    }
};
const bindersQuery = {
    index: binderIndexName,
    body: {
        query: { match_all: {} }
    }
};


// binders_collection_v2
collectionMigration.migrate(collectionQuery, esDoc => {
    const collection = esDoc["_source"];

    // to get thumbnail property: _source{} => thumbnail{}
    const {thumbnail} = collection || undefined;
    if (typeof thumbnail !== "undefined") {
        for (const key in thumbnail) {
            const imageUrl = collection.thumbnail[key];
            if (imageUrl === coverDefault) {
                thumbnail[key] = coverDefaultNewOne;
            } else {
                thumbnail[key] = imageUrl.replace(urlRegex, urlNewOne);
            }
        }
    }
    // reassign thumbnail property
    collection.thumbnail = thumbnail;

    return Promise.resolve({
        data: collection,
        id: esDoc["_id"]
    });
}, collectionIndexName, true);


// publications
publicationMigration.migrate(publicationQuery, esDoc => {
    const collection = esDoc["_source"];

    // to get thumbnail property: _source{} => thumbnail{}
    const {thumbnail} = collection || undefined;
    if (typeof thumbnail !== "undefined") {
        for (const key in thumbnail) {
            const imageUrl = collection.thumbnail[key];
            if (imageUrl === coverDefault) {
                thumbnail[key] = coverDefaultNewOne;
            } else {
                thumbnail[key] = imageUrl.replace(urlRegex, urlNewOne);
            }
        }
    }

    // reassign modified thumbnail property
    collection.thumbnail = thumbnail;


    // to get chunks property: _source{} => modules{} => images{} => chunked[{}] => chunks[{}]
    const {modules : {images: {chunked: [{chunks}]}}} = collection || undefined;
    const rewriteChunks = chunks.map((chunk) => {
        const rewriteChunk = chunk.map((singleChunk) => {
            if (typeof singleChunk === "string") {
                return singleChunk.replace(urlRegex, urlNewOne);
            } else {
                const fixedUrl = singleChunk.url.replace(urlRegex, urlNewOne);
                return { ...singleChunk, url: fixedUrl};
            }
        });
        return rewriteChunk;
    });
    // reassign modified chunks property,
    // note to chunked[0] - chunked.length is allways (?) one element array with chunks
    collection.modules.images.chunked[0].chunks = rewriteChunks;

    return Promise.resolve({
        data: collection,
        id: esDoc["_id"]
    });
}, publicationIndexName, true);


// binders_binders-v2
binderMigration.migrate(bindersQuery, esDoc => {
    const collection = esDoc["_source"];

    // to get thumbnail property: _source{} => thumbnail{}
    const {thumbnail} = collection || undefined;
    if (typeof thumbnail !== "undefined") {
        for (const key in thumbnail) {
            const imageUrl = collection.thumbnail[key];
            if (imageUrl === coverDefault) {
                thumbnail[key] = coverDefaultNewOne;
            } else {
                thumbnail[key] = imageUrl.replace(urlRegex, urlNewOne);
            }
        }
    }
    // reassign modified thumbnail property
    collection.thumbnail = thumbnail;


    // to get chunks property: _source{} => modules{} => images{} => chunked[{}] => chunks[{}]
    const {modules : {images: {chunked: [{chunks}]}}} = collection || undefined;
    const rewriteChunks = chunks.map((chunk) => {
        const rewriteChunk = chunk.map((singleChunk) => {
            if (typeof singleChunk === "string") {
                return singleChunk.replace(urlRegex, urlNewOne);
            } else {
                const fixedUrl = singleChunk.url.replace(urlRegex, urlNewOne);
                return { ...singleChunk, url: fixedUrl};
            }
        });
        return rewriteChunk;
    });
    // reassign modified chunks property,
    // note to chunked[0] - chunked.length is allways (?) one element array with chunks
    collection.modules.images.chunked[0].chunks = rewriteChunks;

    return Promise.resolve({
        data: collection,
        id: esDoc["_id"]
    });
}, binderIndexName, true);


// routing_service.reader_branding collection
BackendRoutingServiceClient.fromConfig(config, "reader").then(routingClient => {
    routingClient.listBrandings().then(brandingList => {
        brandingList.forEach(({logo: {url, ...restLogo}, domain, ...rest}) => {
            const readerBranding: ReaderBranding = {
                logo: {url: url.replace(oldMediaApiUrl, newMediaApiUrl), ...restLogo},
                ...rest
            };
            return routingClient.setBrandingForReaderDomain(domain, readerBranding);
        });
    })
    // tslint:disable-next-line:no-console
        .then(() => console.log("Saved branding correctly."))
        .catch(error => {
        // tslint:disable-next-line:no-console
            console.log(error);
        });
});