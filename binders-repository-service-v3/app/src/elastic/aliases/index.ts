import {
    ElasticRepository,
    ElasticRepositoryConfigFactory,
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Config } from "@binders/client/lib/config/config";
import { DefaultESQueryBuilderHelper } from "../../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../repositoryservice/repositories/binderrepository";
import {
    ElasticCollectionsRepository
} from "../../repositoryservice/repositories/collectionrepository";
import {
    ElasticPublicationsRepository
} from "../../repositoryservice/repositories/publicationrepository";

export async function ensureRepositoryServiceAliases(config: Config): Promise<void> {
    const logger = LoggerBuilder.fromConfig(config, "binders");

    const binderRepositoryConfig = ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Binders])
    await ensureAlias(logger, binderRepositoryConfig, new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config)))

    const collectionRepositoryConfig = ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Collections])
    await ensureAlias(logger, collectionRepositoryConfig, new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config)))

    const publicationRepositoryConfig = ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Pulbications])
    await ensureAlias(logger, publicationRepositoryConfig, new ElasticPublicationsRepository(config, logger, new DefaultESQueryBuilderHelper(config)))
}

export async function existsRepositoryServicesAliasses(config: Config): Promise<boolean> {
    const logger = LoggerBuilder.fromConfig(config, "binders");
    const binderRepositoryConfig = ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Binders])
    const bindersAliasExists =
        await existsAlias(binderRepositoryConfig.aliasedIndexName as string, logger, new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config)));

    const collectionRepositoryConfig = ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Collections])
    const collectionAliasExists =
        await existsAlias(collectionRepositoryConfig.aliasedIndexName as string, logger, new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config)));


    const publicationRepositoryConfig = ElasticRepositoryConfigFactory.build(config, [RepositoryConfigType.Pulbications])
    const publicationAliasExists =
        await existsAlias(publicationRepositoryConfig.aliasedIndexName as string, logger, new ElasticPublicationsRepository(config, logger, new DefaultESQueryBuilderHelper(config)));

    return bindersAliasExists && collectionAliasExists && publicationAliasExists;
}

type AliasParams = { aliasedIndexName?: string | string[], indexName: string | string[] }

async function ensureAlias<T extends ElasticRepository>(logger: Logger, { aliasedIndexName, indexName }: AliasParams, repository: T) {
    await repository.aliasEnsure(aliasedIndexName as string, indexName);
    logger.info(`Ensured alias ${aliasedIndexName} for index ${indexName}`, "elastic-init");
}

async function existsAlias<T extends ElasticRepository>(aliasName: string, logger: Logger, repository: T): Promise<boolean> {
    const exists = await repository.aliasExists(aliasName)
    logger.info(`Alias ${aliasName} exists: ${exists} `, "elastic-init");
    return exists;
}