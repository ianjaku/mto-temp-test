/* eslint-disable no-console */
import {
    BindersConfig as IBindersConfig,
    buildBindersDevConfig,
    buildBindersProductionConfig,
    buildBindersStagingConfig,
    getESProductionBackupRepository,
    getElasticProductionPodNames
} from "../../lib/bindersconfig";
import { ITunnelSpec, withTunnel } from "../k8s/tunnels";
import { addRepository, hasRepository } from "./repository";
import { getClient, getLocalClient } from "./config";
import { isProduction, isStaging } from "../../lib/environment";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Client as ElasticClient } from "@elastic/elasticsearch";
import { getProductionCluster } from "../aks/cluster";
import { listPods } from "../k8s/pods";
import log from "../../lib/logging";


export interface ISnapshotOptions {
    waitForCompletion: boolean;
}

export const takeSnapshot = async (client: ElasticClient,
    repository: string,
    snapshot: string,
    options: Partial<ISnapshotOptions> = {},
    indices?: string): Promise<void> => {

    const params = {
        waitForCompletion: !!options.waitForCompletion,
        repository,
        snapshot,
        masterTimeout: "1h",
        ...(indices ? { body: { indices } } : {})
    };

    console.log(`Creating snapshot with params: ${JSON.stringify(params)}`)
    try {
        await client.snapshot.create(params);
    } catch (err) {
        console.log(`Throwing error when creating snapshot: ${err}`)
    }
};

const getConfig = async (namespace) => {
    if (isProduction()) {
        return buildBindersProductionConfig(getProductionCluster());
    }
    if (isStaging()) {
        return buildBindersStagingConfig(namespace, "develop");
    }
    return buildBindersDevConfig("fake-ip", false, "develop", false);
}

export const getElasticStagingPodNames = async (namespace: string): Promise<string[]> => {
    const pods = await listPods(`${namespace}-elastic`, namespace);
    if (pods.length === 0) {
        throw new Error(`Could not find elastic pod in namespace '${namespace}'`);
    }
    return pods.map(p => p.metadata.name);
}

export const setupElasticRepositories = async (clusterName: string, namespace: string): Promise<void> => {
    const pods = isProduction() ?
        getElasticProductionPodNames(clusterName) :
        await getElasticStagingPodNames(namespace);
    const config = await getConfig(namespace);
    const backupConfig = config.backup.elastic[clusterName];
    if (!backupConfig) {
        log(`Skipping repository setup for ${clusterName}. No config found.`);
        return;
    }

    for (let i = 0; i < pods.length; i++) {
        const podName = pods[i].split(".").shift();
        log(`Creating repository in pod ${podName}`);
        const tunnel: ITunnelSpec = {
            pod: podName,
            localPort: 9200,
            remotePort: 9200,
            namespace,
        };
        const createRepo = async () => {
            try {
                const client = getLocalClient();
                log("Sending elastic command");
                await addRepository(client, backupConfig)
            } catch (ex) {
                log(ex.message);
                log("Waiting 5s for retry");
                await new Promise<void>((resolve) => {
                    setTimeout(
                        async () => {
                            await createRepo();
                            resolve();
                        }, 5000
                    );
                });
            }
        };
        await withTunnel(tunnel, createRepo);
    }
};


const generateSnapshotName = (clusterName: string) => {
    return `${clusterName}-${new Date().toISOString()}`.toLowerCase();
};

export const createClusterSnapshot = async (clusterName: string, customSnapshotName?: string, indices?: string): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bindersConfig: IBindersConfig = (BindersConfig.get() as any).data as IBindersConfig;
    const config = bindersConfig.elasticsearch.clusters["binders"]
    const client = getClient(config);
    const repository = getESProductionBackupRepository();
    if (!(await hasRepository(client, repository))) {
        const elasticBackupConfig = bindersConfig.backup.elastic["binders"]
        await addRepository(client, elasticBackupConfig)
    }
    const options = {
        waitForCompletion: false
    };
    const snapshotName = customSnapshotName ? customSnapshotName : generateSnapshotName(clusterName);
    console.log("now we take snapshot")
    await takeSnapshot(client, repository, snapshotName, options, indices);
    console.log("now we wait for snapshot")
    await waitForSnapshot(client, repository, snapshotName, 30 * 60 * 1000);
    console.log("now we clean old snapshots")
    await cleanOldSnapshots(client, repository, clusterName, 60);
};

async function getSnapshotsToCleanup(client, repository, clusterName, daysToKeep) {
    const cutoff = daysToKeep * 86400000;
    const currentTimeInMs = new Date().getTime();

    const result = await client.snapshot.get({
        repository,
        snapshot: "_all",
        verbose: false,
        masterTimeout: "10m"
    });
    const { snapshots } = result.body;
    const pattern = new RegExp(`^${clusterName}-`);
    return snapshots
        .filter(({ snapshot }) => {
            const createdAt = snapshot.replace(pattern, "")
            return currentTimeInMs - new Date(createdAt).getTime() > cutoff
        })
        .map(({ snapshot }) => snapshot)
}

async function deleteSnapshot(client, repository, name: string, attempt = 0): Promise<void> {
    if (attempt === 0) {
        console.log(`Deleting snapshot ${name}`);
    } else {
        console.log(`(retry ${attempt})`);
    }
    const params = {
        repository: repository,
        snapshot: name,
        masterTimeout: "5m",
    };
    try {
        return await client.snapshot.delete(params);
    } catch (err) {
        if (err.message.indexOf("concurrent_snapshot_execution_exception") > -1) {
            const secondsToSleep = 30;
            console.log(`Previous snapshot delete still in progress. Sleeping ${secondsToSleep}s.`);
            await sleep(secondsToSleep * 1000);
            return deleteSnapshot(client, repository, name, attempt + 1);
        }
        if (err.message.indexOf("snapshot_missing_exception") > -1) {
            console.log(err);
            return;
        }
        console.log(`Throwing error when deleting snapshot: ${err}`)
        throw err;
    }
}


const cleanOldSnapshots = async (client, repository, clusterName, daysToKeep) => {
    const snapshotsToDelete = await getSnapshotsToCleanup(client, repository, clusterName, daysToKeep);
    for (const snapshot of snapshotsToDelete) {
        await deleteSnapshot(client, repository, snapshot);
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getSnapshot = (client, repository, snapshot) => client.snapshot.get({ repository, snapshot });

export const waitForSnapshot = async (client: ElasticClient, repoName: string, snapshotName: string, maxWaitInMs: number): Promise<void> => {
    const start = new Date().getTime();
    let now = new Date().getTime();
    while (now - start < maxWaitInMs) {
        try {
            const snapshotResponse = await getSnapshot(client, repoName, snapshotName);
            const snapshot = snapshotResponse.body.snapshots[0];
            console.log(`Snapthot status: ${snapshot?.state}`)
            if (snapshot.state === "SUCCESS") {
                return;
            }
        } catch (ex) {
            // tslint:disable:no-console
            console.error("Something went wrong while fetching the snapshot:");
            console.error(ex);
        }
        console.log("... Snapshot not ready ...");
        // tslint:enable:no-console
        await sleep(5000);
        now = new Date().getTime();
    }
    console.log("Snapshot not ready yet. Throwing error...")
    throw new Error(`Exceeded ${maxWaitInMs} ms wait. Snapshot not ready yet.`);
};

