import { Client } from "@elastic/elasticsearch";
import { getLocalClient } from "../../actions/elastic/config";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import moment from "moment";
import { runCommand } from "../../lib/commands";
import { runLatestRestore } from "../../actions/elastic/devRestore";
import { sleep } from "../../lib/promises";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bc = require("@binders/binders-service-common/lib/bindersconfig/binders");


const getClient = () => {
    return getLocalClient();
}

const waitForRestore = async (client: Client, iterations = 1) => {
    if (iterations > 12 * 15) {
        throw new Error("Restore not completed after 15 minutes");
    }
    const health = await client.cluster.health();
    const percentageActive = Number.parseInt(health.body.active_shards_percent_as_number as string, 10);
    if (percentageActive < 50) {
        log("Waiting for restore to complete.");
        await sleep(5000);
        await waitForRestore(client, iterations + 1);
    }
    log("Restore completed.");
};

const getDocumentCutoff = () => {
    const now = moment();
    const currentWeekDay = now.weekday();
    //For weekends go back three days
    const dayDelta = (currentWeekDay === 0 || currentWeekDay === 6) ? 5 : 3;
    return now.subtract(dayDelta, "days");
}

const validateDocumentPresent = async (client: Client, binderId: string) => {
    const index = "binders-binders-v3"
    const searchResult = await client.search({
        index,
        body: {
            query: {
                term: {
                    _id: binderId
                }
            }
        }
    });
    if (searchResult.body.hits.hits.length != 1) {
        log(JSON.stringify(searchResult.body.hits.hits));
        throw new Error(`Could not find binder with id ${binderId}`);
    }
    log(`Found binder with id ${binderId}`);
}

const validateLastPublication = async (client: Client) => {
    const index =  "publications"
    const cutoff = getDocumentCutoff();
    const lastPublicationSearchResult = await client.search({
        index,
        body: {
            size: 1,
            query: {
                match_all: {}
            },
            sort: [
                {
                    "publicationDate": {
                        "order": "desc"
                    }
                }
            ]
        }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastPublication = lastPublicationSearchResult.body.hits.hits[0]._source as any;
    const lastPublicationMoment = moment(lastPublication.publicationDate);
    if (lastPublicationMoment.isBefore(cutoff)) {
        throw new Error(`Could not find a publication more recent then ${cutoff.toISOString()}`);
    }
    log(`Latest publication is valid, published at: ${lastPublicationMoment.toISOString()}`);
}

const validateLastUserAction = async (client: Client) => {
    const cutoff = getDocumentCutoff();
    const lastUserActionSearchResult = await client.search({
        index: "useractions",
        body: {
            size: 1,
            query: {
                match_all: {}
            },
            sort: [
                {
                    "start": {
                        "order": "desc"
                    }
                }
            ]
        }
    });
    const lastUserAction = lastUserActionSearchResult.body.hits.hits[0]._source;
    const lastUserActionMoment = moment(lastUserAction.start);
    if (lastUserActionMoment.isBefore(cutoff)) {
        throw new Error(`Could not find a user action more recent then ${cutoff.toISOString()}`);
    }
    log(`Latest user action is valid, started at: ${lastUserActionMoment.toISOString()}`);
}

const validateRestore = async (client: Client) => {
    const binderId = "AWerRFrlYVmKqY4NOFZB"; // Railways
    await validateDocumentPresent(client, binderId,);
    await validateLastPublication(client);
    await validateLastUserAction(client)
    log("Restore valid.")
}

const stopElastic = async () => {
    await runCommand("pkill", ["-9", "-f", "java"]);
}

const doIt = async () => {
    await sleep(120000);
    const config = bc.BindersConfig.get();
    const client = getClient();
    const backupKey = "backup.elastic.bindersAzure"
    const backupBinderClusterConfig = config.getObject(backupKey).get()
    try {
        try {
            await runLatestRestore(client, backupBinderClusterConfig);
        } catch (err) {
            log("Something went wrong")
            log(err.message || err);
        }
        log("Waiting for restore")
        await waitForRestore(client);
        await validateRestore(client);
    }
    finally {
        log("stopping elasticsearch")
        await stopElastic()
    }
}

main(doIt);


