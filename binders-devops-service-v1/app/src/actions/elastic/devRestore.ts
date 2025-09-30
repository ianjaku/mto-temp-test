import * as elastic from "@elastic/elasticsearch";
import { addRepository, hasRepository } from "./repository";
import { ProductionClusterBackupConfig } from "../../lib/bindersconfig";
import log from "../../lib/logging";

// DATE=2019.09.17
// _snapshot/manualto_s3/backup_$DATE/_restore
// {
//     "indices": "binders_binders-v2,publications,binders_collections_v2,useractions-*"
// }

const getLatestSnapshot = async (client: elastic.Client, repositoryName: string) => {
    const snapShots = await client.cat.snapshots<string>({
        repository: repositoryName,
        s: ["end_epoch"],
        h: ["id", "status"]
    });
    const snapshots = snapShots.body.split("\n").filter(snapshot => snapshot)
    for (let index = snapshots.length - 1; index >= 0; index--) {
        const [snapshotName, status] = snapshots[index].trim().split(/\s+/)
        if(status === "SUCCESS") {
            return snapshotName
        }
    }
    throw new Error("Could not find a valid backup in the repository");
};


async function deleteIndices(client, indices) {
    for (const index of indices) {
        try {
            await client.indices.delete({ index });
        } catch (exc) {
            log(`Failed to delete index ${index}`);
            // eslint-disable-next-line no-console
            console.error(exc);
        }
    }
}


const restoreSnapshot = async (client: elastic.Client, repository: string, snapshot: string, indicesOverride?: string[]) => {
    const defaultIndices = "binders-binders-v3,binders-collections-v3,publications-v3,useractions-*";
    const indices = indicesOverride?.join(",") || defaultIndices;
    if (indicesOverride) {
        log(`Deleting indices: ${indices}`);
        await deleteIndices(client, indicesOverride)
    }
    log(`Initiating restore of ${snapshot} from ${repository}. Indices: ${indices}`);
    const restoreConfig = {
        repository,
        snapshot,
        wait_for_completion: true,
        body: {
            indices
        },
        masterTimeout: "500s"
    }
    await client.snapshot.restore(restoreConfig);
};

export const runLatestRestore = async (
    client: elastic.Client,
    backupConfig: ProductionClusterBackupConfig,
    snapshotName?: string,
    indices?: string[]
): Promise<void> => {
    const { repositoryName } = backupConfig;
    const isPresent = await hasRepository(client, repositoryName);
    if (!isPresent) {
        await addRepository(client, backupConfig)
        log(`creating the elastic ${backupConfig.repositoryType} repository`);
    } else {
        log("repository already exists");
    }

    const snapshot = snapshotName ? snapshotName : await getLatestSnapshot(client, repositoryName);
    await restoreSnapshot(client, repositoryName, snapshot, indices);
};