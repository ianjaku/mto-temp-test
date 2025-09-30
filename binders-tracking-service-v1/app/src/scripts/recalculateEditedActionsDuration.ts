/* eslint-disable no-console */
import {
    IUserAction,
    IUserActionData,
    UserActionType
} from  "@binders/client/lib/clients/trackingservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    BackendAccountServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    ElasticUserActionsRepository
} from  "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { omit } from "ramda";

const SCRIPT_NAME = "recalculateEditedActionsDuration";

function getUserActionsRepo() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    return new ElasticUserActionsRepository(config, logger);
}

function getAccountRepo(): Promise<AccountServiceClient> {
    const config = BindersConfig.get();
    return BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
}

function stringDateToMSTimestamp(dateStr): number {
    return (new Date(dateStr)).getTime();
}

function durationForAction(userAction: IUserAction<IUserActionData>): number {
    if (userAction.end != null && userAction.start) {
        return (stringDateToMSTimestamp(userAction.end) - stringDateToMSTimestamp(userAction.start)) / 1000;
    }
    if (userAction.duration > 5000) {
        return userAction.duration / 1000;
    }
    return userAction.duration;
}

function fixAction(userAction: IUserAction<IUserActionData>): IUserAction<IUserActionData> {
    const duration = durationForAction(userAction);
    const userActionWihoutSort = omit(["sort"], userAction);
    return {...userActionWihoutSort, duration};
}

async function recalculateEditedActionsDuration() {
    const accountsRepo = await getAccountRepo();
    const userActionsRepo = getUserActionsRepo();

    const accounts = await accountsRepo.findAccounts({});

    for (const [index, account] of Object.entries(accounts)) {
        console.log(`[${parseInt(index)+1}/${accounts.length}] Fixing account ${account.id}`);
        const actions = await userActionsRepo.find({ accountId: account.id , userActionTypes: [UserActionType.ITEM_EDITED] })
        if(actions.length > 0) {
            const fixedActions = actions.map(fixAction);
            await userActionsRepo.multiUpdateUserAction(fixedActions);
        }

    }
}

recalculateEditedActionsDuration()
    .then(
        () => {
            console.log("All done!");
            process.exit(0);
        },
        err => {
            console.error(err);
            process.exit(1);
        }
    );

