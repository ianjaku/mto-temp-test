/* eslint-disable no-console */
import * as elastic from "@elastic/elasticsearch";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const elasticConfigKey = "elasticsearch.clusters.binders";

const s3Repository = "manualto_s3_5_6";

// tslint:disable:no-console
const getOptions = () => {
    const days = (process.argv.length !== 1) ?
        60 :
        parseInt(process.argv[2], 10);
    return {
        days
    };
};

const configKey = "elasticsearch.clusters.binders";
const config = BindersConfig.get();
const elasticConfig = config.getObject(configKey);

if (elasticConfig.isNothing()) {
    console.error(`Missing ES client config: ${elasticConfigKey}`);
    process.abort();
}

const options: {days: number} = getOptions();
const client = new elastic.Client(Object.assign({}, elasticConfig.get()));

const cutoff = options.days * 86400000;
const currentTimeInMs = new Date().getTime();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const chunkifyArr = (r, j) => r.reduce((a, b, i, g) => !(i % j) ? a.concat([g.slice(i, i + j)]) : a, []);

async function cleanup() {
    console.log(`looking for snapshots older than ${options.days} days`);
    const snapshotsToCleanup = await getSnapshotsToCleanup();
    console.log(`${snapshotsToCleanup.length} snapshots found older than ${options.days} days`);
    console.log(snapshotsToCleanup)
    if (snapshotsToCleanup.length > 0) {
        await handleDeleteSnapshots(snapshotsToCleanup);
    }
    console.log("all done");
}

interface RepositoryItem {
    snapshot: string
}

async function getSnapshotsToCleanup() {
    const result = await client.snapshot.get({
        repository: s3Repository,
        snapshot: "_all",
        verbose: false,
    }, {
        requestTimeout: "500000"
    });
    const { snapshots } = result.body;
    return snapshots
        .filter(({snapshot}: RepositoryItem) => {
            const createdAt = snapshot.replace(/^binders-/,"")
            return currentTimeInMs - new Date(createdAt).getTime() > cutoff
        })

        .map(({snapshot}: RepositoryItem) => snapshot)
}

async function handleDeleteSnapshots(snapshots) {
    for (const snapshot of snapshots) {
        console.log(await deleteSnapshot(snapshot));
    }
}

const sleep = (sleepInMs) => new Promise( resolve => setTimeout(resolve, sleepInMs));

async function deleteSnapshot(name: string, attempt = 0): Promise<void> {
    if (attempt === 0) {
        console.log(`Deleting snapshot ${name}`);
    } else {
        console.log(`(retry ${attempt})`);
    }
    const params = {
        repository: s3Repository,
        snapshot: name,
        requestTimeout: "1500000",
    };
    try {
        await client.snapshot.delete(params);
        return;
    } catch (err) {
        if (err.message.indexOf("concurrent_snapshot_execution_exception") > -1) {
            const secondsToSleep = 30;
            console.log(`Previous snapshot delete still in progress. Sleeping ${secondsToSleep}s.`);
            await sleep(secondsToSleep * 1000);
            return deleteSnapshot(name, attempt + 1);
        }
        if (err.message.indexOf("snapshot_missing_exception") > -1) {
            console.log(err);
            return;
        }
        throw err;
    }
}

const doIt = async () => {
    await cleanup()
}

const start = Date.now();
doIt()
    .then((k) => {
        console.log(k)
        console.log(`All done in ${(Date.now() - start) / 60000} minutes`);
        process.exit(0);
    },
    error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });