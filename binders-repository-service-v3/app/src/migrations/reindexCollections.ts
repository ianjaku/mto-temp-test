/* eslint-disable no-console */
import { MappingFileName, getMapping } from "../elastic/mappings/ensureMapping";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import {
    ElasticCollectionsRepository
} from "../repositoryservice/repositories/collectionrepository";
import { ElasticMigrator } from "./migration";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const newIndexName = "binders_collections_v2";
const sourceIndexName =  "binders_collections";
const sourceRepo = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
const targetRepo = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));

const migration = new ElasticMigrator(sourceRepo, targetRepo);

targetRepo.ensureMapping(getMapping(MappingFileName.COLLECTION))
    .then(() => {
        console.log("Ensured mapping for collection in target repo");
        const query = {
            index: sourceIndexName,
            body: {
                query: { match_all: {} }
            }
        };
        return migration.migrate(query, esDoc => {
            const collection = esDoc["_source"];
            collection.isRootCollection = false;
            return Promise.resolve({
                data: collection,
                id: esDoc["_id"]
            });
        }, newIndexName, false);
    })
    .catch( error => {
        console.error("!!!! Something went wrong");
        console.error(error);
    });