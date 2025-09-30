import { addDays, isBefore } from "date-fns";
import { deleteBlob, listBlobs } from "../azure/storage";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import log from "../../lib/logging";
import { runCommand } from "../../lib/commands";
import { sequential } from "../../lib/promises";

export interface MongoBackupConfig {
    archiveFileFullPath?: string
    collection?: string
    uri: string
}

export const runBackup = async (backupConfig: MongoBackupConfig): Promise<string> => {
    const { archiveFileFullPath, collection, uri } = backupConfig
    const archiveFile = archiveFileFullPath || "/tmp/backup.arch";
    const args = [
        `--uri=${uri}`,
        `--archive=${archiveFile}`,
        "--readPreference=secondary",
        "--gzip",
        "--numParallelCollections=1"
    ];

    if(collection) {
        args.push(`--collection=${collection}`)
    }

    await runCommand("mongodump", args);
    return archiveFile;
};

export const cleanOldBackupsFromAzure = async (logger: Logger, key: string, account: string, container: string, daysToKeep: number): Promise<void> => {
    const blobs = await listBlobs(logger, key, account, container);
    const now = new Date();
    const cutOffDate = addDays(now, -daysToKeep);
    const toDelete = blobs.filter(b => isBefore(b?.properties?.createdOn, cutOffDate));
    log(`Going to delete ${toDelete.length} backups`);
    return sequential(b => deleteBlob(logger, key, account, container, b.name), toDelete);
};

export interface IMongoRestoreOptions {
    excludeNamespace: string; // Only namespaces that don't match this string will be restored (* is a wildcard)
    includeNamespace: string; // Only namespaces matching this string will be restored (* is a wildcard)
}
export const runRestore = async (uri: string, archiveFileFullPath: string, restoreOptions: Partial<IMongoRestoreOptions> = {}): Promise<void> => {
    const args = [
        `--uri=${uri}`,
        `--archive=${archiveFileFullPath}`,
        "--gzip"
    ];
    if (restoreOptions.excludeNamespace) {
        args.push(`--nsExclude=${restoreOptions.excludeNamespace}`);
    } else if (restoreOptions.includeNamespace) {
        args.push(`--nsInclude=${restoreOptions.includeNamespace}`);
    }
    try {
        await runCommand("mongorestore", args);
    } catch (error) {
        log("Error during restore!!!")
        log(error)
    }
}

export const getLatestBackupArchive = async (logger: Logger, key: string, account: string, container: string): Promise<string> => {
    const backupBlobs = await listBlobs(logger, key, account, container);
    const archives = backupBlobs
        .filter(backupBlob => backupBlob.name.endsWith(".arch"))
        .map(backupBlob => ({
            name: backupBlob.name,
            when: backupBlob?.properties?.createdOn.getTime() || 0,
        }));
    if (archives.length === 0) {
        throw new Error("Could not find a single backup.");
    }
    archives.sort((left, right) => left.when - right.when);
    return archives.pop().name;
}

export const getBackupArchiveWithName = async (logger: Logger, key: string, account: string, container: string, name: string): Promise<string> => {
    const backupBlobs = await listBlobs(logger, key, account, container);
    const archives = backupBlobs
        .filter(backupBlob => backupBlob.name.startsWith(name))
        .map(backupBlob => backupBlob.name);
    if (archives.length === 0) {
        throw new Error(`Could not find a backup matching ${name}`);
    } else if (archives.length > 1) {
        throw new Error(`Too many matches for the provided name ${name}: [${archives.join(", ")}]`);
    } else {
        return archives[0];
    }
};
