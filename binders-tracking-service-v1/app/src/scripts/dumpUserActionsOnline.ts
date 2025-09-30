/* eslint-disable no-console */
import * as fs from "fs";
import { BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ElasticUserActionsRepository } from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { UserCache } from "./helpers/userCache";
import { isManualToLogin } from "@binders/client/lib/util/user";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);
const accountId = "aid-ff1ce900-6ac9-479d-959c-5d301ed71380";
const userActionType = UserActionType.USER_ONLINE;
const fileName = "/tmp/volvo-daily-logins.csv";
const dumpDay = "2021-10-10T00:00:00.000Z";


const buildProcessBatch = (fileName: string, userCache: UserCache) => {
    const fd = fs.openSync(fileName, "w");
    fs.writeSync(fd, "User,Login,Day\n");
    return async (batch) => {
        for (let i = 0; i<batch.length; i++) {
            const doc = batch[i]._source;
            if (!doc?.data?.users?.length) {
                continue;
            }
            for (let j=0; j<doc.data.users.length; j++) {
                const userId = doc.data.users[j];
                try {
                    if (!userId || userId === "public") {
                        continue;
                    }
                    const details = await userCache.getUserDetails(userId);
                    if (isManualToLogin(details.login)) {
                        continue;
                    }
                    fs.writeSync(fd, `${details.displayName},${details.login},${doc.start}\n`);
                } catch (err) {
                    console.log(userId);
                    console.error(err);
                }
            }
        }
    };
}

const doIt = async () => {

    const repo = new ElasticUserActionsRepository(config, logger);
    const query = {
        index: "useractions",
        body: {
            query: {
                "bool": {
                    "must":[
                        {
                            term: {
                                userActionType
                            }
                        },
                        {
                            term: {
                                accountId
                            }
                        },
                        {
                            term: {
                                start: dumpDay
                            }
                        }
                    ]
                }
            }
        },
    };
    const scrollAge = 3600;
    const batchSize = 10000;
    const userClient = await BackendUserServiceClient.fromConfig(config, "dump-online-csv");
    await repo.runScroll(query, scrollAge, batchSize, buildProcessBatch(fileName, new UserCache(userClient)));
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
