/* eslint-disable no-console */
import { ElasticUserActionsRepository } from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ObjectConfig } from "@binders/client/lib/config/config";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { writeFileSync } from "fs";

const configData = {
    elasticsearch: {
        clusters: {
            useractions: {
                host: "localhost:9200",
                apiVersion: "5.6"
            }
        }
    },
    logging: {
        default: {
            level: "TRACE"
        }
    }
};

const config = new ObjectConfig(configData);
const logger = LoggerBuilder.fromConfig(config);
const userActionType = UserActionType.DOCUMENT_READ;
const fileName = `/tmp/useractions/useractions-${UserActionType[userActionType]}.json`;

const allUserActions = [];

const processBatch = async (batch) => {
    const dataFields = batch.map(hit => {
        const doc = hit._source;
        return {
            userId: doc.userId,
            accountId: doc.accountId,
            itemKind: doc.data.itemKind,
            itemId: doc.data.itemId,
            when: doc.start
        };
    });
    allUserActions.push(...dataFields);
}

const doIt = async () => {

    const repo = new ElasticUserActionsRepository(config, logger);
    const query = {
        index: "useractions",
        body: {
            query: {
                term: {
                    userActionType
                }
            }
        }
    };
    const scrollAge = 3600;
    const batchSize = 1000;
    await repo.runScroll(query, scrollAge, batchSize, processBatch)
    writeFileSync(fileName, JSON.stringify(allUserActions));
};

doIt()
    .then(
        () => {
            console.log("All done!");
            process.exit(0);
        },
        err => {
            console.error(err);
            process.exit(1);
        }
    )
