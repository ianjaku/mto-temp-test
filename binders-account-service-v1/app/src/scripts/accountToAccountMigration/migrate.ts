import {
    MigrationScriptContext,
    getAccountMigrationLogRepo,
    getScriptContext, log
} from "./util";
import { Command } from "commander";
import { migrateAccountMembers } from "./entities/accountMembers";

const SCRIPT_NAME = "migrate";

type ScriptOptions = {
    debug?: boolean;
    dryRun?: boolean;
    fromAccountId: string;
    toAccountId: string;
};

async function preflightSteps(): Promise<void> {
    // Enable static page
    // Other checks
}

async function performAccountToAccountMigration(scriptContext: MigrationScriptContext): Promise<void> {
    // Migrate each service data, one at a time
    // For the items, populate the routing info to allow the routing mechanism to kick in
    await migrateAccountMembers(scriptContext);
}

async function postflightSteps(): Promise<void> {
    // Clear the last 4 aggregates for the target account
    // Clear the caches (binder statuses, authorization)
    // Disable static page
}

function parseArgs() {
    const program = new Command();
    program
        .name(SCRIPT_NAME)
        .description("Migrate account data from one account to another")
        .option("--dryRun [dryRun]", "Dry run mode (will not make any changes)")
        .option("--fromAccountId [fromAccountId]", "The account to migrate data from")
        .option("--toAccountId [toAccountId]", "The account to migrate data into")

    program.parse(process.argv);
    return program.opts() as ScriptOptions;
}

const doIt = async () => {
    const runId = Date.now().toString();
    log("Running migration with runId", runId);
    const { fromAccountId, toAccountId, dryRun = false } = parseArgs();
    if (!fromAccountId || !toAccountId) {
        throw new Error("fromAccountId and toAccountId are required");
    }
    const scriptContext: MigrationScriptContext = {
        ...getScriptContext(SCRIPT_NAME),
        runId,
        fromAccountId,
        toAccountId,
        dryRun,
        logRecordMigrationFn: undefined,
    };
    const accountMigrationLogRepo = await getAccountMigrationLogRepo(scriptContext);
    scriptContext.logRecordMigrationFn = async (migratedEntity, details) => {
        const migrationLog = { runId, fromAccountId, toAccountId, migratedEntity, details };
        if (dryRun) {
            log("Would have added the following migration log", JSON.stringify(migrationLog));
        } else {
            await accountMigrationLogRepo.log(migrationLog);
        }
    }
    await preflightSteps();
    await performAccountToAccountMigration(scriptContext);
    await postflightSteps();
    log("Completed migration with runId", runId);
}

doIt().then(() => {
    log("All done!");
});