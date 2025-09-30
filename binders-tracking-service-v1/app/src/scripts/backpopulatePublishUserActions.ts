/* eslint-disable no-console */
import {
    AuditLogType,
    IPublishAuditLogData,
    IUserAction,
    IUserActionPublishData,
    PublishUpdateActionType,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { AuditLog } from "../trackingservice/models/auditLog";
import { AuditLogRepositoryFactory } from "../trackingservice/repositories/auditLogRepository";
import { BackendAccountServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { ElasticUserActionsRepository } from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { splitEvery } from "ramda";

const scriptName = "backpopulatePublishUserActions";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const program = new Command();

program
    .name(scriptName)
    .description("This script will backpopulate all the publish and unpublish actions to ES")
    .option("-d, --dry", "if set, do not replace domain")
    .option("-c, --clean", "for testing purposes: attempts to remove all publish and unpublish actions from ES")

program.parse(process.argv);
const options = program.opts() as { dry: boolean, clean: boolean, bulkInsertSize: number };

async function getAccountIds(): Promise<string[]> {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, scriptName);
    const allAccounts = await accountServiceClient.listAccounts();
    return allAccounts.map(account => account.id);
}

function userActionFromEvent(event: AuditLog<IPublishAuditLogData>): IUserAction<IUserActionPublishData> {
    const userActionType = event.data.publishUpdateAction === PublishUpdateActionType.PUBLISHED_DOCUMENT ?
        UserActionType.DOCUMENT_PUBLISHED :
        UserActionType.DOCUMENT_UNPUBLISHED;
    const eventDate = new Date(event.timestamp);
    return {
        data: {
            binderId: event.data.binderId,
            publicationId: event.data.publicationId,
            languageCode: event.data.languageCode,
        },
        accountId: event.accountId.value(),
        userId: event.userId.value(),
        userActionType,
        start: eventDate,
        end: eventDate,
    }
}

const doIt = async () => {

    const auditLogRepositoryFactory = await AuditLogRepositoryFactory.fromConfig(config, logger);
    const auditLogRepository = auditLogRepositoryFactory.build(logger);

    const userActionsRepository = new ElasticUserActionsRepository(config, logger);
    if (options.clean) {
        if (options.dry) {
            console.log("Would have removed all the published and unpublished actions from ES");
        } else {
            const result = await userActionsRepository.deleteUserActionsByFilter({
                userActionTypes: [UserActionType.DOCUMENT_PUBLISHED, UserActionType.DOCUMENT_UNPUBLISHED]
            }, 50_000);
            console.log("Removed", result, "published and unpublished actions from ES");
            if (result > 0) {
                console.log("Please run the script again to make sure there are no extra user actions");
            }
        }
        return;
    }

    let totalEventsNumber = 0;
    const accountIds = await getAccountIds();
    for (const accountId of accountIds) {
        console.log(`====================== Processing ${accountId} ===================`);
        const auditLogs = await auditLogRepository.findLogs({
            accountId,
            logType: AuditLogType.PUBLISH_DOCUMENT
        });
        if (auditLogs.length === 0) {
            console.log("Found 0 entries, skipping account");
            continue;
        }
        console.log("Found", auditLogs.length, "entries");
        const userActions = auditLogs.map(userActionFromEvent);
        for (const userActionsChunk of splitEvery(1000, userActions)) {
            if (options.dry) {
                console.log("Would have added", userActionsChunk.length, "entries");
            } else {
                console.log("Adding", userActionsChunk.length, "entries");
                await userActionsRepository.multiInsertUserAction(userActionsChunk);
            }
        }
        totalEventsNumber += userActions.length;
    }
    console.log("Backpopulated a total of", totalEventsNumber, "entries");
};

doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    }, error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });
