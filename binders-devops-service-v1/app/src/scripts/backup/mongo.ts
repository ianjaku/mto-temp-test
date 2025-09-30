import { BindersConfig, PRODUCTION_CONFIG } from "../../lib/bindersconfig";
import { CommandLineParser, IProgramDefinition, OptionType  } from "../../lib/optionParser";
import { cleanOldBackupsFromAzure, runBackup } from "../../actions/mongo/backup";
import {
    BindersConfig as BConfig
} from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { loadFile } from "../../lib/fs";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { storeFileAsBlob } from "../../actions/azure/storage";

interface BackupMongoOption {
    database?: string,
    collection?: string
    cluster: string
    replicaSet: string
}

const getOptions = (): BackupMongoOption => {
    const programDefinition: IProgramDefinition = {
        database: {
            long: "database",
            short: "d",
            description: "Specifies a database to backup",
            kind: OptionType.STRING
        },
        collection: {
            long: "collection",
            short: "c",
            kind: OptionType.STRING,
            description: "Specifies a collection to backup",
        }
    }
    const parser = new CommandLineParser("BackupMongoOption", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { database, collection } = (<any>parser.parse()) as BackupMongoOption
    return {
        database,
        collection,
        cluster: "main",
        replicaSet: "mongo-main-service"
    }
}

const buildUri = (config: BindersConfig, cluster: string, replicaSet: string, database = "") => {
    const { login, password } = config.backup.mongo.credentials;
    const clusterConfig = config.mongo.clusters[cluster];
    const hosts = clusterConfig.instances
        .map( ({host, port}) => `${host}:${port}`)
        .join(",");
    return `mongodb://${login}:${password}@${hosts}/${database}?replicaSet=${replicaSet}&authSource=admin`;
};

function getArchiveName(collection?: string): string {
    const suffix = new Date().toISOString()
    return collection ? `${collection}${suffix}.arch` : `${suffix}.arch`;
}

const doIt = async () => {
    const { cluster, replicaSet, database, collection } = getOptions();
    const config: BindersConfig = JSON.parse(await loadFile(PRODUCTION_CONFIG));
    const uri = buildUri(config, cluster, replicaSet, database);
    const archiveFileBasename = getArchiveName(collection)
    const archiveFileFullPath = `/tmp/${archiveFileBasename}`
    log("Starting mongo backup");
    const backupConfig = {
        archiveFileFullPath,
        collection,
        uri
    }
    const localFile = await runBackup(backupConfig);
    log("Backup complete.");
    const azureConfig = config.azure.blobs["mongobackups"];
    const bConfig = BConfig.get();
    const logger = LoggerBuilder.fromConfig(bConfig, "mongoBackup");
    log("Sending backup to azure");
    await storeFileAsBlob(logger, azureConfig.accessKey, azureConfig.account, azureConfig.container, archiveFileBasename, localFile);
    log("Cleaning old backups");
    await cleanOldBackupsFromAzure(logger, azureConfig.accessKey, azureConfig.account, azureConfig.container, 60);
};

main(doIt);