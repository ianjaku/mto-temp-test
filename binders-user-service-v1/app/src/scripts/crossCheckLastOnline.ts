/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    IUserAction,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { MongoUserRepository, MongoUserRepositoryFactory } from "../userservice/repositories/users";
import { BackendTrackingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { isAfter } from "date-fns";
import mongoose from "mongoose";

const { accountId, isDryRun } = (() => {
    if (process.argv.length < 3) {
        console.error(`Usage: node ${__filename} <ACCOUNT_ID> <DRY_RUN>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
        isDryRun: process.argv[3] === "dryrun"
    };
})();

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

async function getUserRepo(): Promise<MongoUserRepository> {
    const userCollectionConfig = await CollectionConfig.promiseFromConfig(config, "users", getMongoLogin("user_service"));
    const userRepositoryFactory = new MongoUserRepositoryFactory(userCollectionConfig, logger);
    return userRepositoryFactory.build(logger);
}

const allUserActionTypes = [
    UserActionType.DOCUMENT_READ,
    UserActionType.ITEM_CREATED,
    UserActionType.ITEM_DELETED,
    UserActionType.ITEM_EDITED,
    UserActionType.USER_ONLINE,
    UserActionType.COLLECTION_VIEW,
    UserActionType.LANGUAGE_ADDED,
    UserActionType.LANGUAGE_DELETED,
]

async function findActivity(userIds: string[]): Promise<Map<string, Date>> {
    const trackingServiceClient = await BackendTrackingServiceClient.fromConfig(config, "crosscheck-lastonline-script");
    const findResult = await trackingServiceClient.findUserActions({ userIds, userActionTypes: allUserActionTypes, accountId });
    const userActions: IUserAction[] = findResult.userActions;
    return userActions.reduce((reduced, userAction) => {
        const lastUserActionEnd = reduced.get(userAction.userId);
        if (!lastUserActionEnd || isAfter(new Date(userAction.end), new Date(lastUserActionEnd))) {
            reduced.set(userAction.userId, userAction.end);
        }
        return reduced;
    }, new Map<string, Date>());
}

(async function doIt() {
    const userRepo = await getUserRepo();
    async function getUserIdsWithoutLastOnline() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usersWOLastOnline = await (userRepo as any).findEntities(
            { lastOnline: mongoose.trusted({ $type: 10 }) },
            { limit: 99999 }
        );
        return usersWOLastOnline.map(user => user.userId);
    }

    async function completeLastOnline(activity: Map<string, Date>) {
        for await (const userId of activity.keys()) {
            const lastOnline = activity.get(userId);
            if (lastOnline) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (userRepo as any).update({ userId }, { lastOnline });
                console.log(`completed ${userId}`);
            }
        }
    }

    const userIds = await getUserIdsWithoutLastOnline();
    const activity = userIds.length && await findActivity(userIds);

    console.log(`${userIds.length} users found without lastOnline date. ${activity ? `Activity detected in ${activity.size} of them:` : ""}`);
    if (activity) {
        console.log("activity", activity);
    }

    if (activity && !isDryRun) {
        await completeLastOnline(activity);
    }

    process.exit(0);
})();
