import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { MongoBinderVisualRepository, MongoBinderVisualRepositoryFactory } from "../api/repositories/binderVisualRepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Query } from "@binders/binders-service-common/lib/mongo/repository";
import { Visual } from "../api/model";


const getBinderVisualRepository = async (config: Config, logger: Logger): Promise<MongoBinderVisualRepository> => {
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption);
    const factory = new MongoBinderVisualRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

export const processAll = async (
    config: BindersConfig,
    logger: Logger,
    processVisual: (visual: Visual, i: number, repo: MongoBinderVisualRepository) => Promise<void>,
    query: Query = {},
    maxTimeMS?: number
): Promise<void> => {
    const repo = await getBinderVisualRepository(config, logger);
    let i = 1;
    return repo.runScroll(async (visual: Visual) => {
        await processVisual(visual, i, repo);
        i++;
    }, query, maxTimeMS);
}
