/* eslint-disable no-console */
import {
    DefaultESQueryBuilderHelper,
    ESQueryBuilderHelper
} from "../../src/repositoryservice/esquery/helper";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MappingFileName, getMapping } from "../elastic/mappings/ensureMapping";
import { SettingFileName, getSettings } from "../elastic/settings/ensure";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import {
    ElasticCollectionsRepository
} from "../repositoryservice/repositories/collectionrepository";
import {
    ElasticPublicationsRepository
} from "../repositoryservice/repositories/publicationrepository";

const reindexBinders = async (config: BindersConfig, logger: Logger, queryBuilderHelper: ESQueryBuilderHelper): Promise<void> => {
    const repo = new ElasticBindersRepository(config, logger, queryBuilderHelper)
    const mapping = getMapping(MappingFileName.BINDERS)
    const settings = getSettings(SettingFileName.BINDERS)
    const cfg = {
        mapping,
        settings,
        oldIndexName: "binders_binders-v2",
        newIndexName: "binders-binders-v3",
    }
    await repo.reindex(cfg)
}

const reindexCollections = async (config: BindersConfig, logger: Logger, queryBuilderHelper: ESQueryBuilderHelper): Promise<void> => {
    const repo = new ElasticCollectionsRepository(
        config,
        logger,
        queryBuilderHelper
    );
    const mapping = getMapping(MappingFileName.COLLECTION)
    const cfg = {
        mapping,
        oldIndexName: "binders_collections_v2",
        newIndexName: "binders-collections-v3",
    }
    await repo.reindex(cfg)
}

const reindexPublications = async (config: BindersConfig, logger: Logger, queryBuilderHelper: ESQueryBuilderHelper): Promise<void> => {
    const repo = new ElasticPublicationsRepository(config, logger, queryBuilderHelper)
    const mapping = getMapping(MappingFileName.PUBLICATION)
    const settings = getSettings(SettingFileName.PUBLICATION)
    const cfg = {
        mapping,
        settings,
        oldIndexName: "publications",
        newIndexName: "publications-v2",
    }
    await repo.reindex(cfg)
}


const doIt = async () => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, "reindex-repository-service-indices");
    const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
    const category = "reindex-repository-service"
    logger.info("Starting reindexing binders index", category)
    await reindexBinders(config, logger, queryBuilderHelper)
    logger.info("Starting reindexing collection index", category)
    await reindexCollections(config, logger, queryBuilderHelper)
    logger.info("Starting reindexing publication index", category)
    await reindexPublications(config, logger, queryBuilderHelper)
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1)
    }
);