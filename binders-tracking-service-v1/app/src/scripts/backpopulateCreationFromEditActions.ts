/* eslint-disable no-console */
import * as readline from "readline";
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    BindersRepositoryServiceContract,
    ItemKind
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    EventRepository,
    TrackingRepositoryFactory
} from "../trackingservice/repositories/eventRepository";
import {
    EventType,
    IUserAction,
    ItemCreatedUserActionData,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { LoggerBuilder, debugLog } from "@binders/binders-service-common/lib/util/logging";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { Event } from "../trackingservice/models/event";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { splitEvery } from "ramda";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const scriptName = "backpopulateCreationFromEditActions";
const program = new Command();

/**
 * For every account, list all binders
 *  For every binder in this account:
 *      1. Check if there is a create action for the binder; if so, skip
 *      2. Get the oldest `ITEM_EDITED` action for the binder
 *      3. Log an `ITEM_CREATED` event for the user that did the oldest edit action. The event should include `backpopulatedFromCreation: true` in the `data` field
 *      3. Log an `ITEM_CREATED` user action for the user that did the oldest edit action. The action should include `backpopulatedFromCreation: true` in the `data` field
*/

program
    .name(scriptName)
    .description("Backpopulate missing ITEM_CREATED events and useractions via the ITEM_EDITED useractions")
    .option("-a, --account <accountId>", "The account id (optional, if not provided will process all accounts)")
    .option("-d, --dry-run", "If set, no changes will be made, only log what would be done.")

interface ParsedOptions {
    accountId?: string;
    dryRun?: boolean;
}

const getOptions = (): ParsedOptions => {
    program.parse(process.argv);
    const opts = program.opts() as { account?: string; dryRun?: boolean };
    return {
        accountId: opts.account,
        dryRun: opts.dryRun
    };
}

const askConfirmation = async (question: string): Promise<boolean> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
        });
    });
}

const getRepoServiceClient = async () => {
    return BackendRepoServiceClient.fromConfig(config, scriptName);
}

const getAccountServiceClient = async () => {
    return BackendAccountServiceClient.fromConfig(config, scriptName);
}

const getEventsRepository = async () => {
    const trackingRepositoryFactory = await TrackingRepositoryFactory.fromConfig(config, logger);
    return trackingRepositoryFactory.build(logger);
}

function getUserActionsRepo() {
    const logger = LoggerBuilder.fromConfig(config, scriptName);
    return new ElasticUserActionsRepository(config, logger);
}

const buildLookupMaps = async (
    accountId: string,
    userActionsRepo: ElasticUserActionsRepository,
) => {
    console.log("Fetching existing actions...");

    const allCreateActions = await userActionsRepo.find({ accountId, userActionTypes: [UserActionType.ITEM_CREATED] });
    const oldestEditActionsByItem = await userActionsRepo.findOldestPerItemId({ accountId, userActionTypes: [UserActionType.ITEM_EDITED] });

    const createActionsByItem = new Map<string, IUserAction>();
    for (const createAction of allCreateActions) {
        if (!(createAction.data.itemId)) {
            console.error(`ITEM_CREATED action ${createAction.id} missing itemId, skipping`);
            continue;
        }
        createActionsByItem.set(createAction.data.itemId, createAction);
    }
    return [createActionsByItem, oldestEditActionsByItem];
}

async function processAccount(
    accountId: string,
    accountName: string,
    repoClient: BindersRepositoryServiceContract,
    eventsRepository: EventRepository,
    userActionsRepo: ElasticUserActionsRepository,
    dryRun: boolean
): Promise<{ processedCount: number; skippedCount: number; createdEventCount: number; createdUserActionCount: number; errorCount: number }> {
    debugLog(`\nProcessing account: ${accountName} (${accountId})`);

    let processedCount = 0;
    let skippedCount = 0;
    let createdEventCount = 0;
    let createdUserActionCount = 0;
    let errorCount = 0;

    try {

        const binders = await repoClient.findBindersBackend(
            { accountId },
            { maxResults: 9999 }
        ) as Binder[];

        console.log(`Found ${binders.length} binders to process`);
        const [createActionsByItem, oldestEditActionsByItem] = await buildLookupMaps(accountId, userActionsRepo);

        const eventsToInsert: Event[] = [];
        const userActionsToInsert: IUserAction<ItemCreatedUserActionData>[] = [];

        for (const binder of binders) {
            processedCount++;

            if (processedCount % 100 === 0) {
                console.log(`Progress: ${processedCount}/${binders.length} binders processed`);
            }

            try {
                // Check if creation action already exists for this binder
                if (createActionsByItem.get(binder.id)) {
                    skippedCount++;
                    continue;
                }

                // Get oldest edit action for this binder from pre-fetched data
                const oldestEditAction = oldestEditActionsByItem.get(binder.id);
                if (!oldestEditAction) {
                    skippedCount++;
                    continue;
                }

                const itemTitle = extractTitle(binder);

                let createdAt: Date;
                if (binder.created) {
                    createdAt = new Date(binder.created);
                } else {
                    createdAt = new Date(oldestEditAction.start.getTime() - 1); // subtract 1ms to ensure the ID (composed based on timestamp) doesn't clash with the edit action
                }

                // Create backpopulated ITEM_CREATED event
                eventsToInsert.push(new Event(
                    EventType.ITEM_CREATED,
                    createdAt,
                    new Date(), // Current time as logged time
                    {
                        itemId: binder.id,
                        itemKind: ItemKind.Binder,
                        itemTitle,
                        backpopulatedFromEditEvent: true,
                    },
                    accountId,
                    oldestEditAction.userId,
                ));

                userActionsToInsert.push({
                    accountId,
                    userId: oldestEditAction.userId,
                    userActionType: UserActionType.ITEM_CREATED,
                    start: createdAt,
                    end: createdAt,
                    duration: 0,
                    data: {
                        itemId: binder.id,
                        itemKind: ItemKind.Binder,
                        itemTitle,
                        backpopulatedFromEditEvent: true,
                    }
                } as IUserAction<ItemCreatedUserActionData>);

            } catch (error) {
                console.error(`Error processing binder ${binder.id}: ${error.message}`);
                errorCount++;
            }
        }

        const eventBatches = splitEvery(100, eventsToInsert);
        for (const [i, eventBatch] of eventBatches.entries()) {
            if (dryRun) {
                console.log(`[DRY RUN] Would insert batch ${i + 1}/${eventBatches.length} of ${eventBatch.length} events`);
            } else {
                await eventsRepository.logEvents(eventBatch);
                console.log(`Inserted batch ${i + 1}/${eventBatches.length} of ${eventBatch.length} events`);
            }
            createdEventCount += eventBatch.length;
        }
        const userActionBatches = splitEvery(100, userActionsToInsert);
        for (const [i, userActionBatch] of userActionBatches.entries()) {
            if (dryRun) {
                console.log(`[DRY RUN] Would insert batch ${i + 1}/${userActionBatches.length} of ${userActionBatch.length} user actions`);
            } else {
                await userActionsRepo.multiInsertUserAction(userActionBatch);
                console.log(`Inserted batch ${i + 1}/${userActionBatches.length} of ${userActionBatch.length} user actions`);
            }
            createdUserActionCount += userActionBatch.length;
        }

    } catch (error) {
        console.error(`Error processing account ${accountName}: ${error.message}`);
        errorCount++;
    }

    return { processedCount, skippedCount, createdEventCount, createdUserActionCount, errorCount };
}

async function doIt(): Promise<void> {
    const { accountId, dryRun } = getOptions();

    if (dryRun) {
        console.log("DRY RUN MODE - No changes will be made");
    }

    const startTime = Date.now();
    let totalProcessedCount = 0;
    let totalSkippedCount = 0;
    let totalCreatedEventCount = 0;
    let totalCreatedUserActionCount = 0;
    let totalErrorCount = 0;
    let accountsToProcess = [];

    try {
        const [repoClient, accountClient, eventsRepository, userActionsRepo] = await Promise.all([
            getRepoServiceClient(),
            getAccountServiceClient(),
            getEventsRepository(),
            getUserActionsRepo(),
        ]);

        if (accountId) {
            // Single account mode
            const account = await accountClient.getAccount(accountId);
            if (!account) {
                console.error(`Account ${accountId} not found`);
                process.exit(1);
            }
            console.log(`Starting backpopulation for account ${account.name} (${accountId})`);
            accountsToProcess = [account];
        } else {
            // All accounts mode
            const allAccounts = await accountClient.listAccounts();
            console.log(`Found ${allAccounts.length} accounts in the system`);

            const confirmed = await askConfirmation(
                `Are you sure you want to process ALL ${allAccounts.length} accounts? (y/n): `
            );

            if (!confirmed) {
                console.log("Operation cancelled by user");
                process.exit(0);
            }

            console.log("Starting backpopulation for all accounts");
            accountsToProcess = allAccounts;
        }

        // Process each account
        for (const account of accountsToProcess) {
            const results = await processAccount(
                account.id,
                account.name,
                repoClient,
                eventsRepository,
                userActionsRepo,
                dryRun
            );

            totalProcessedCount += results.processedCount;
            totalSkippedCount += results.skippedCount;
            totalCreatedEventCount += results.createdUserActionCount;
            totalCreatedUserActionCount += results.createdUserActionCount;
            totalErrorCount += results.errorCount;
        }

    } catch (error) {
        console.error("Fatal error:", error);
        process.exit(1);
    }

    // Print summary
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log("\n=== Overall Summary ===");
    console.log(`Total accounts processed: ${accountId ? 1 : accountsToProcess.length}`);
    console.log(`Total binders processed: ${totalProcessedCount}`);
    console.log(`Total events created: ${totalCreatedEventCount}`);
    console.log(`Total user actions created: ${totalCreatedUserActionCount}`);
    console.log(`Total binders skipped: ${totalSkippedCount}`);
    console.log(`Total errors: ${totalErrorCount}`);
    console.log(`Time taken: ${duration} seconds`);
    if (dryRun) {
        console.log("DRY RUN - No actual changes were made");
    }
    process.exit(0);
}

(async () => {
    await doIt();
})();

