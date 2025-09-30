/* eslint-disable @typescript-eslint/no-var-requires */
import { runRestore as doRestore, getLatestBackupArchive } from "../../actions/mongo/backup";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { buildUri } from "../../actions/mongo/config";
import { getBlobAsLocalFile } from "../../actions/azure/storage";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import moment from "moment";
import { sleep } from "../../lib/promises";

const MongoClient = require("mongodb").MongoClient;
const bc = require("@binders/binders-service-common/lib/bindersconfig/binders");

const downloadArchive = async (config): Promise<string> => {
    const logger = LoggerBuilder.fromConfig(config, "validateLatestMongoRestore");
    const { accessKey, account, container } = config.getObject("azure").get().blobs["mongobackups"];
    const archive = await getLatestBackupArchive(logger, accessKey, account, container);
    const localFile = `/tmp/${archive}`;
    log(`Downloading latest backup file to ${localFile}`);
    await getBlobAsLocalFile(logger, accessKey, account, container, archive, localFile, true);
    return localFile;
}

const getRestoreTargetUri = () => {
    const hosts = [{ host: "127.0.0.1", port: 27017 }];
    return buildUri(hosts);
}

const runRestore = async (uri: string, archive: string): Promise<void> => {
    log(`Restoring archive ${archive}`);
    await doRestore(uri, archive);
}

const getMongoClient = (uri: string) => {
    return new Promise((resolve, reject) => {
        MongoClient.connect(uri, function (err, client) {
            if (err) {
                reject(err);
            } else {
                resolve(client);
            }
        });

    })
}

const getLatestEvent = async (collection) => {
    return new Promise((resolve, reject) => {
        collection.find({})
            .sort([["timestamp", -1]])
            .limit(1)
            .toArray((err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result[0]);
                }
            })
    });
}

const getEventCutoff = () => {
    const now = moment();
    const currentWeekDay = now.weekday();
    // For weekends go back three days
    const dayDelta = (currentWeekDay === 0 || currentWeekDay === 6) ? 3 : 1;
    return now.subtract(dayDelta, "days");
}

const getLatestEventTable = async (client): Promise<{ collectionName: string }> => {
    const db = client.db("tracking_service");
    const collection = db.collection("event_repo_mapping");
    return new Promise((resolve, reject) => {
        collection.find({})
            .sort([["start", -1]])
            .limit(1)
            .toArray((err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result[0]);
                }
            })
    });
}

const validateLatestEvent = async (client) => {
    const db = client.db("tracking_service");
    const latestEventTable = await getLatestEventTable(client)
    if (!latestEventTable || !latestEventTable.collectionName) {
        throw new Error(`Can't find latest collection: ${latestEventTable}`)
    }
    const collection = db.collection(latestEventTable.collectionName);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latestEvent: any = await getLatestEvent(collection);
    const latestEventMoment = moment(latestEvent.timestamp);
    const cutoff = getEventCutoff();
    if (latestEventMoment.isBefore(cutoff)) {
        throw new Error(`Latest event is too old: ${latestEventMoment.toISOString()}`);
    } else {
        log(`Found valid latest event: ${latestEventMoment.toLocaleString()}`);
    }
}

const validateRestore = async (uri) => {
    let client;
    try {
        const client = await getMongoClient(uri);
        await validateLatestEvent(client);
    } finally {
        if (client && client.close) {
            client.close();
        }
    }
}

const stopMongo = async (uri) => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = await getMongoClient(uri);
        const db = client.db("admin");
        await db.command({ shutdown: 1 });
    } catch (err) {
        log(err.message);
    }
}

const doIt = async () => {
    await sleep(30000);
    const config = bc.BindersConfig.get();
    const archive = await downloadArchive(config);
    const uri = getRestoreTargetUri();
    await runRestore(uri, archive);
    await validateRestore(uri);
    await stopMongo(uri);
}

main(doIt);