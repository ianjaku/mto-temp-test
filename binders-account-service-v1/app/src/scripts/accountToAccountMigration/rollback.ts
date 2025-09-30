import {
    RollbackScriptContext,
    getAccountMigrationLogRepo,
    getScriptContext,
    log
} from "./util";
import { Command } from "commander";
import { rollbackAccountMembersMigration } from "./entities/accountMembers";

const SCRIPT_NAME = "rollback";

type ScriptOptions = {
    debug?: boolean;
    dryRun?: boolean;
    runId: string;
    fromAccountId: string;
    toAccountId: string;
};

async function preflightSteps(): Promise<void> {
    // Other checks
}

async function performAccountToAccountMigrationRollback(scriptContext: RollbackScriptContext): Promise<void> {
    // Rollback each service data, one at a time in reverse order compared to the migration script
    // For the items, revert the routing info to allow the routing mechanism to stop redirecting
    await rollbackAccountMembersMigration(scriptContext);
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
        .description("Rollback account-to-account migration by reversing migrated data using a specified run ID")
        .option("--dryRun [dryRun]", "Dry run mode (will not make any changes)")
        .option("--runId [runId]", "The migration run ID to rollback");

    program.parse(process.argv);
    return program.opts() as ScriptOptions;
}

const doIt = async () => {
    const { runId, dryRun = false } = parseArgs();
    if (!runId) {
        throw new Error("runId is required");
    }
    const scriptContext: RollbackScriptContext = {
        ...getScriptContext(SCRIPT_NAME),
        runId,
        dryRun,
        migrationLogRecordFinderFn: undefined,
    }
    const accountMigrationLogRepo = await getAccountMigrationLogRepo(scriptContext);
    scriptContext.migrationLogRecordFinderFn = async (migratedEntity) => {
        return accountMigrationLogRepo.findLog(runId, migratedEntity);
    }
    await preflightSteps();
    await performAccountToAccountMigrationRollback(scriptContext);
    await postflightSteps();
}

doIt().then(() => {
    log("All done!");
})