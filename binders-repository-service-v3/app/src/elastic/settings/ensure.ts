import * as fs from "fs";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Config } from "@binders/client/lib/config/config";
import { DefaultESQueryBuilderHelper } from "../../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../repositoryservice/repositories/binderrepository";
import { ElasticPublicationsRepository } from "../../repositoryservice/repositories/publicationrepository";
import { ElasticRepository } from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";

export enum SettingFileName {
    BINDERS = "binders",
    PUBLICATION = "publication"
}

export function validateAndCastSettingFileName(input: string): SettingFileName | undefined {
    const values = Object.values(SettingFileName);

    if (values.includes(input as SettingFileName)) {
        return input as SettingFileName;
    }

    return undefined;
}

export function getSettings(settingsFileName: SettingFileName): Record<string,unknown> {
    const settingsFile = fs.realpathSync(`./src/elastic/settings/${settingsFileName}.json`);
    if (typeof settingsFile === "undefined") {
        // eslint-disable-next-line no-console
        console.log(`!!! Could not find settings file for type ${settingsFileName}.`);
        process.abort();
    }
    return JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function ensureAllSettings(config: Config) {
    const logger = LoggerBuilder.fromConfig(config, "binders");
    const skipBindersExists = await ensureBinderSettings(config, logger);
    const skipPublicastionsExists = await ensurePublicationSettings(config, logger);
    return {
        skipBindersExists,
        skipPublicastionsExists
    };
}

async function ensureSettings(logger: Logger, repository: ElasticRepository, settingsFileName: SettingFileName) {
    const allowEnsureSettingForProd = process.env.BINDERS_ELASTIC_ALLOW_ENSURE_SETTINGS === "allow"
    const skipExists = await repository.ensureSettings(getSettings(settingsFileName), allowEnsureSettingForProd);
    logger.info(`Ensured settings for ${settingsFileName}`, "elastic-init");
    return skipExists;
}

function ensureBinderSettings(config, logger) {
    const repo = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    return ensureSettings(logger, repo, SettingFileName.BINDERS);
}

function ensurePublicationSettings(config, logger) {
    const repo = new ElasticPublicationsRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    return ensureSettings(logger, repo, SettingFileName.PUBLICATION);
}
