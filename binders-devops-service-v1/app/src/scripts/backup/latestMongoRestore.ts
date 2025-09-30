/**
* Usage example: node latestMongoRestore.js -f <path to restore file (optional, downloaded if not given)> -t (optional command for including tracking service database for local and staging environments)
*
* This script does not restore the tracking_service db by default, because it's very big.
* If you want to recover the tracking_service db, it is recommended to first make a full recovery of everything else.
* Then change "excludeNamespace" to "includeNamespace" and run the script again.
*/
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { getBackupArchiveWithName, getLatestBackupArchive, runRestore } from "../../actions/mongo/backup";
import { isProduction, isStaging } from "../../lib/environment";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ConnectionConfig } from "@binders/binders-service-common/lib/mongo/config";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Maybe } from "@binders/client/lib/monad";
import { getBlobAsLocalFile } from "../../actions/azure/storage";
import { loadProductionSecrets } from "../../lib/bindersconfig";
import log from "../../lib/logging";
import { main } from "../../lib/program";


type LatestMongoRestoreOption = {
    backupFilePath: string | undefined;
    includeTrackingNamespace: boolean;
    backupFileName: string | undefined;
    includeAuditLog: boolean
}

const getOptions = (): LatestMongoRestoreOption => {
    const programDefinition: IProgramDefinition = {
        backupFilePath: {
            long: "backupFilePath",
            short: "f",
            description: "Use a local backup file located at provided path",
            kind: OptionType.STRING
        },
        includeTrackingNamespace: {
            long: "includeTrackingNamespace",
            short: "t",
            kind: OptionType.BOOLEAN,
            default: false,
            description: "Include all tracking_service database including all collections",
        },
        includeAuditLog: {
            long: "includeAuditLog",
            short: "a",
            kind: OptionType.BOOLEAN,
            default: false,
            description: "Include tracking_service.auditLog namespace in restore",
        },
        backupFileName: {
            long: "backupFileName",
            short: "n",
            description: "Will restore this specific backup file rather than the latest. Name must match the blob store one",
            kind: OptionType.STRING,
            required: false,
        }
    }
    const parser = new CommandLineParser("LatestMongoRestoreOption", programDefinition)
    const options = parser.parse<LatestMongoRestoreOption>();
    if (options.backupFileName && options.backupFilePath) {
        log("backupFileName and backupFilePath cannot be defined together");
        process.exit(1);
    }
    return options;
}

const buildUri = (config, cluster: string, replicaSet: string) => {
    const clusterConfig = config.getObject("mongo").get().clusters[cluster];
    const hosts = clusterConfig.instances
    const maybeReplicaSet = replicaSet ? Maybe.just(replicaSet) : Maybe.nothing<string>()
    const credentials = config.getObject("mongo").get().credentials
    const connectionConfig = credentials?.admin ?
        new ConnectionConfig(hosts, Maybe.just("admin"), Maybe.just(credentials.admin), "", maybeReplicaSet) :
        new ConnectionConfig(hosts, Maybe.nothing<string>(), Maybe.nothing<string>(), "", maybeReplicaSet)
    return connectionConfig.toConnectionString();
};

const getConfig = async () => {
    return BindersConfig.get();
}

interface RestoreConfig {
    bindersConfig: BindersConfig,
    cluster: string,
    localFile: string,
    replicaSet?: string,
    includeTrackingNamespace?: boolean
}

async function restoreDefault(config: RestoreConfig) {
    const { bindersConfig, cluster, replicaSet, localFile, includeTrackingNamespace } = config
    const uri = buildUri(bindersConfig, cluster, isProduction() ? replicaSet : undefined);
    const options = isProduction() || includeTrackingNamespace ?
        {} :
        {
            excludeNamespace: "tracking_service.*"
        };
    await runRestore(uri, localFile, options);
}

async function restoreEventsMapping(config: RestoreConfig) {
    if (isStaging()) {
        log(`Restoring events mapping from ${config.localFile}`);
        const { bindersConfig, cluster, localFile } = config
        const uri = buildUri(bindersConfig, cluster, undefined);
        const options = {
            includeNamespace: "tracking_service.event_repo_mapping"
        };
        await runRestore(uri, localFile, options);
    }
}

async function restoreAuditLog(config: RestoreConfig) {
    log(`Restoring auditLog from ${config.localFile}`);
    const { bindersConfig, cluster, localFile } = config
    const uri = buildUri(bindersConfig, cluster, undefined);
    const options = {
        includeNamespace: "tracking_service.auditLog"
    };
    await runRestore(uri, localFile, options);
}


const doIt = async () => {
    const cluster = "main"
    const replicaSet = "mongo-main-service"

    const { backupFilePath, includeTrackingNamespace, backupFileName, includeAuditLog } = getOptions();
    const bindersConfig = await getConfig();
    let localFile: string;
    if (!backupFilePath) {
        const productionSecrets = await loadProductionSecrets()
        const { accessKey, account, container } = productionSecrets.azure.blobs["mongobackups"];
        const logger = LoggerBuilder.fromConfig(bindersConfig, "latestMongoRestore");
        const mongoBackup = backupFileName ?
            await getBackupArchiveWithName(logger, accessKey, account, container, backupFileName) :
            await getLatestBackupArchive(logger, accessKey, account, container);
        localFile = `/tmp/${mongoBackup}`;
        log(`Downloading backup file to ${localFile}`);
        await getBlobAsLocalFile(logger, accessKey, account, container, mongoBackup, localFile, true);
    } else {
        localFile = backupFilePath;
        log(`Using local backup up: ${localFile}`);
    }
    log(`Restoring databases (excluding tracking) ${localFile}`);
    await restoreDefault({
        bindersConfig,
        cluster,
        localFile,
        includeTrackingNamespace,
        replicaSet
    })
    if(includeAuditLog) {
        await restoreAuditLog({
            bindersConfig,
            cluster,
            localFile
        })
    }
    await restoreEventsMapping({
        bindersConfig,
        cluster,
        localFile
    })
    log("Done");
};

main(doIt);