import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { AccountMigrationLog } from "../../accountservice/model";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BackendAccountServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Config } from "@binders/client/lib/config";
import { MongoAccountMigrationLogRepositoryFactory } from "../../accountservice/repositories/accountMigrationLog";

// eslint-disable-next-line no-console
export const log = console.log;

type ScriptContext = {
    config: Config,
    logger: Logger,
    scriptName: string,
}

type LogRecordMigrationFn = (migratedEntity: string, details?: Record<string, unknown>) => Promise<void>;
type MigrationLogRecordFinderFn = (migratedEntity: string) => Promise<AccountMigrationLog>;

export type MigrationScriptContext = ScriptContext & {
    runId: string,
    fromAccountId: string,
    toAccountId: string,
    dryRun: boolean,
    logRecordMigrationFn: LogRecordMigrationFn,
}

export type RollbackScriptContext = ScriptContext & {
    runId: string,
    dryRun: boolean,
    migrationLogRecordFinderFn: MigrationLogRecordFinderFn,
}

export function getScriptContext(scriptName: string): ScriptContext {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, scriptName);
    return {
        config, logger, scriptName
    }
}

export async function getAccountMigrationLogRepo({ config, logger }: ScriptContext) {
    const loginOption = getMongoLogin("account_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "accountMigrationLog", loginOption);
    return new MongoAccountMigrationLogRepositoryFactory(collectionConfig, logger).build(logger);
}

export async function getBackendAccountServiceClient({ config, scriptName }: ScriptContext): Promise<AccountServiceClient> {
    return BackendAccountServiceClient.fromConfig(config, scriptName);
}
