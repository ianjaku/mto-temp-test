/**
 * Description:
 *      This script will find all items that have no connection to the root collection (=orphans)
 *      and either hard delete, soft delete, or add them to the root collection.
 *  
 *      - If an orphan binder has only 1 chunk -> Hard delete
 *      - If an orphan collection has no children -> Hard delete
 *      - If an orphan was deleted more than 180 days ago -> Hard delete
 *      - If an orphan was deleted fewer than 180 days ago -> Add to the root collection
 *      - If none of the other conditions apply -> Soft delete & add to the root collection
 * 
 *  Usage (run in container):
 *      node dist/src/scripts/fixOrphanItems/index.js [--live] [--timeLimitSec=180]
 * 
 *  Options:
 *      --live: Without this flag, the script will run in dry run mode, and won't actually do anything but print what it would do.
 */
/* eslint-disable no-console */
import { fixOrphanItems } from "./fixOrphanItems";

const getOptions = () => {
    const isDryRun = !process.argv.includes("--live");
    const accountOptions = process.argv.filter(arg => arg.startsWith("--account=")) ?? [];
    const accountIds = accountOptions.map(arg => arg.split("=")[1]);

    return {
        isDryRun,
        accountIds: accountIds.length > 0 ? accountIds : null
    };
};

fixOrphanItems({
    isDryRun: getOptions().isDryRun,
    accountIds: getOptions().accountIds
})
    .then(() => console.log("--- Finished ---"))
    .catch(e => console.log("Failure!!!", e));
