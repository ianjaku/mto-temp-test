/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DUMMY_USERACTION_KEY } from "./constants";
import { ElasticUserActionsRepository } from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";

const UserActionTypeExtended = {
    ...UserActionType,
    "DUMMY": `${DUMMY_USERACTION_KEY}`,
    [`${DUMMY_USERACTION_KEY}`]: "DUMMY",
};

const getOptions = () => {
    const { argv } = process;
    const hasOptions = argv.length > 2;
    if (!hasOptions) {
        console.log("Error: provide user action type");
        process.exit(1);
    }
    return {
        userActionTypeKey: argv[2],
    };
};

function getUserActionsRepo() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, "delete-useractions");
    return new ElasticUserActionsRepository(config, logger);
}

(async function () {

    const { userActionTypeKey: userActionTypeKeyStr } = getOptions();
    const userActionTypeKey = parseInt(userActionTypeKeyStr);
    if (isNaN(userActionTypeKey) || !UserActionTypeExtended[userActionTypeKey]) {
        console.log("Error: userActionType must be a number used in UserActionType enum");
        process.exit(1);
    }

    const userActionsRepo = getUserActionsRepo();
    const deletedCount = await userActionsRepo.deleteUserActions({
        userActionType: userActionTypeKey,
    });

    console.log(`All done! ${deletedCount} ${UserActionTypeExtended[userActionTypeKey]} user actions deleted`);
    process.exit(0);
})();
