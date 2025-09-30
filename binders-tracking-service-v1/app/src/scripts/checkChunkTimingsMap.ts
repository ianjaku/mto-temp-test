/* eslint-disable no-console */
import {
    ElasticUserActionsRepository,
    UserActionsFilter
} from "../trackingservice/repositories/userActionsRepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";

const getOptions = () => {
    return {
        count: process.argv.includes("count"),
    };
};

function getUserActionsRepo() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, "delete-useractions");
    return new ElasticUserActionsRepository(config, logger);
}

(async () => {
    const { count } = getOptions();
    const userActionsRepo = getUserActionsRepo();
    const filter: UserActionsFilter = {
        userActionTypes: [UserActionType.DOCUMENT_READ],
        missingField: "data.chunkTimingsMap",
    };
    const result = (count) ?
        await userActionsRepo.countUserActions(filter) :
        await userActionsRepo.find(filter);
    console.log(result);
    console.log("All done!");
})();