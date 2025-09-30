import {
    MigrationScriptContext,
    RollbackScriptContext,
    getBackendAccountServiceClient,
    log
} from "../util";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";

/*
 * Logic to migrate the account members, it will only add to the new accounts the members
 * that are not already in it, and it follows up by updating the members cound and the licenses
 *
 * NOTE: this piece of logic relies on the backend implementation for adding/removing members
 * from and account, this is to avoid duplicating the logic that does all the counting and calculations
 */

const ENTITY_NAME = "account.members";

export async function migrateAccountMembers(scriptContext: MigrationScriptContext): Promise<void> {
    const accountClient = await getBackendAccountServiceClient(scriptContext);
    const { fromAccountId, toAccountId, dryRun, logRecordMigrationFn } = scriptContext;
    const fromAccount = await accountClient.getAccount(fromAccountId);
    const toAccount = await accountClient.getAccount(toAccountId);
    const toAccountMemberIds = new Set(toAccount.members);
    const userIdsToMigrate = fromAccount.members.filter(userId => !toAccountMemberIds.has(userId));
    if (dryRun) {
        log(`Would have added the following users from account ${fromAccountId} to the target account ${toAccountId}`, JSON.stringify(userIdsToMigrate));
    } else {
        log(`Adding the following users from account ${fromAccountId} to the target account ${toAccountId}`, JSON.stringify(userIdsToMigrate));
        await accountClient.addMembers(toAccountId, userIdsToMigrate, ManageMemberTrigger.MIGRATION);
    }
    await logRecordMigrationFn(ENTITY_NAME, {
        migratedUserIds: userIdsToMigrate,
    });
    log("Completed account members migration");
}

export async function rollbackAccountMembersMigration(scriptContext: RollbackScriptContext): Promise<void> {
    const accountClient = await getBackendAccountServiceClient(scriptContext);
    const { dryRun, migrationLogRecordFinderFn } = scriptContext;

    const migrationData = await migrationLogRecordFinderFn(ENTITY_NAME);
    const { migratedUserIds } = migrationData.details as { migratedUserIds: string[] };
    if (dryRun) {
        log("Would have removed the following users from account", JSON.stringify(migratedUserIds));
    } else {
        await accountClient.removeMembers(migrationData.toAccountId, migratedUserIds, ManageMemberTrigger.MIGRATION);
    }
    log("Completed account members migration rollback");
}