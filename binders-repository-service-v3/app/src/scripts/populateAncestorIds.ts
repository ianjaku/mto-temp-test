/**
* This script adds the correct ancestorIds value to binders, collections, and publications
*
* Usage:
*      yarn workspace @binders/binders-v3 node dist/src/scripts/populateAncestorIds.js [arguments]
*
* Arguments:
*      --quick: With this flag, will only look for binders where the ancestorIds field is missing
*      --errorOnMissingAncestorIds: With this flag, will log an error if the ancestorIds field is missing
*                                   Has to be used together with --quick, otherwise it doesn't do anything
*      --batchSize: Number of documents to process in each batch. Default is 200
*
*/
/* eslint-disable no-console */
import {
    Binder,
    DocumentCollection,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { BulkBuilder } from "@binders/binders-service-common/lib/elasticsearch/bulkbuilder";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import {
    ElasticCollectionsRepository
} from "../repositoryservice/repositories/collectionrepository";
import { ElasticMultiRepository } from "../repositoryservice/repositories/multirepository";
import {
    ElasticPublicationsRepository
} from "../repositoryservice/repositories/publicationrepository";
import { IndicesGetMappingIndexMappingRecord } from "@elastic/elasticsearch/api/types";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import {
    getAllParentsFromDocumentAncestors
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";

const getOptions = () => {
    const batchSizeArg = process.argv.find(arg => arg.startsWith("--batchSize="));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1]) : 200;
    return {
        // With this flag, will only look for binders where the ancestorIds field is missing
        quick: process.argv.includes("--quick"),
        // Has to be used together with --quick, otherwise it doesn't do anything
        errorOnMissingAncestorIds: process.argv.includes("--errorOnMissingAncestorIds"),
        batchSize
    };
};

const verifyAncestorIdsMapping = (mapping: IndicesGetMappingIndexMappingRecord) => {
    const ancestorIdsMapping = mapping.mappings.properties?.ancestorIds?.type;
    if (ancestorIdsMapping !== "keyword") {
        throw new Error(`Mapping for ancestorIds is incorrect. Expected keyword, got ${ancestorIdsMapping}`);
    }
}

const run = async () => {
    const options = getOptions();
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);
    const multiRepo = new ElasticMultiRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    const binderRepo = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    const collectionRepo = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    const publicationRepo = new ElasticPublicationsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    const repoService = await BackendRepoServiceClient.fromConfig(config, "populateAncestorIds");

    const binderMapping = await binderRepo.getMapping();
    verifyAncestorIdsMapping(binderMapping);
    const collectionMapping = await collectionRepo.getMapping();
    verifyAncestorIdsMapping(collectionMapping);
    const publicationMapping = await publicationRepo.getMapping();
    verifyAncestorIdsMapping(publicationMapping);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = { match_all: {} }
    if (options.quick) {
        query = { bool: { must_not: { exists: { field: "ancestorIds" } } } };
    }

    await multiRepo.runScroll({
        index: multiRepo.getIndexesNames([RepositoryConfigType.Collections]),
        body: { query }
    }, 3600, options.batchSize, async (batch: { _id: string; _source: DocumentCollection }[]) => {
        const documentAncestors = await repoService.getItemsAncestors(batch.map(b => b._id));
        let bulkBuilder = new BulkBuilder([]);
        for (const esHit of batch) {
            if (options.errorOnMissingAncestorIds && esHit._source.ancestorIds == null) {
                logger.error(`Missing ancestorIds for item: ${esHit._id}`, "ancestorIds");
            }
            const ancestorIds = getAllParentsFromDocumentAncestors(esHit._id, documentAncestors);
            bulkBuilder = bulkBuilder.addUpdate(
                collectionRepo.getIndexName(),
                esHit._id,
                { ancestorIds }
            );
        }
        await multiRepo.runBulk(bulkBuilder, { ignoreDuplicates: true });
    })

    await multiRepo.runScroll({
        index: multiRepo.getIndexesNames([RepositoryConfigType.Pulbications]),
        body: {
            query: {
                bool: {
                    must: [
                        { term: { isActive: "true" } },
                        query
                    ]
                }
            }
        }
    }, 3600, options.batchSize, async (batch: { _id: string; _source: Publication }[]) => {
        const documentAncestors = await repoService.getItemsAncestors(batch.map(b => b._source.binderId));
        let bulkBuilder = new BulkBuilder([]);
        for (const esHit of batch) {
            if (options.errorOnMissingAncestorIds && esHit._source.ancestorIds == null) {
                logger.error(`Missing ancestorIds for item: ${esHit._id}`, "ancestorIds");
            }
            const ancestorIds = getAllParentsFromDocumentAncestors(esHit._source.binderId, documentAncestors);
            bulkBuilder = bulkBuilder.addUpdate(
                publicationRepo.getIndexName(),
                esHit._id,
                { ancestorIds }
            );
        }
        await multiRepo.runBulk(bulkBuilder, { ignoreDuplicates: true });
    });

    await multiRepo.runScroll({
        index: multiRepo.getIndexesNames([RepositoryConfigType.Binders]),
        body: { query }
    }, 3600, options.batchSize, async (batch: { _id: string; _source: Binder }[]) => {
        const documentAncestors = await repoService.getItemsAncestors(batch.map(b => b._id));
        let bulkBuilder = new BulkBuilder([]);
        for (const esHit of batch) {
            if (options.errorOnMissingAncestorIds && esHit._source.ancestorIds == null) {
                logger.error(`Missing ancestorIds for item: ${esHit._id}`, "ancestorIds");
            }
            const ancestorIds = getAllParentsFromDocumentAncestors(esHit._id, documentAncestors)
            bulkBuilder = bulkBuilder.addUpdate(
                binderRepo.getIndexName(),
                esHit._id,
                { ancestorIds }
            );
        }
        await multiRepo.runBulk(bulkBuilder, { ignoreDuplicates: true });
    });
}

run()
    .then(() => {
        console.log("Finished \\ (•◡•) /")
        process.exit(0);
    }, error => {
        console.error(error)
        process.exit(1)
    });
