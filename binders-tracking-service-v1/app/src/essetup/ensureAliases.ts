import { Config } from "@binders/client/lib/config/config";
import { ElasticUserActionsRepository } from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { fmtDate } from "@binders/client/lib/util/date";

export const INDEX_PREFIXES = {
    v1: "useractions-",
    v2: "useractions-v2-"
}

export const CURRENT_INDEX_PREFIX = INDEX_PREFIXES.v2;
export const PREVIOUS_INDEX_PREFIX = INDEX_PREFIXES.v1;

const INDEX_DATE_FORMAT = "yyyyMMdd";
export const getCurrentIndexName = (): string => `${CURRENT_INDEX_PREFIX}${fmtDate(new Date(), INDEX_DATE_FORMAT)}`;

export const ensureAliases = async (config: Config): Promise<boolean> => {
    const logger = LoggerBuilder.fromConfig(config, "useractions");
    const repo = new ElasticUserActionsRepository(config, logger);
    const indexName = getCurrentIndexName();
    const exists = await repo.indexExists(indexName);
    if (!exists) {
        await repo.createIndex(indexName);
    }
    await repo.aliasEnsure("useractions", `${CURRENT_INDEX_PREFIX}*`)
    logger.info("Ensured useractions alias", "elastic-init");
    return exists;
}