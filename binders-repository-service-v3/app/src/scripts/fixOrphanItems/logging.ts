/**
 * Logging for the fixOrphanItems script
 */
/* eslint-disable no-console */
import { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";

type FixAction = "addToRoot" | "SoftDelete" | "HardDelete";
const logs: { actions: FixAction[]; reason: string; id: string; accountId: string; }[] = [];
const fixesPerAccount: {accountId: string; accountName: string; count: number }[] = [];
let totalFixes = 0;

export const logItem = (
    item: Binder | DocumentCollection,
    actions: FixAction[],
    reason: string,
): void => {
    logs.push({ actions, reason, id: item.id, accountId: item.accountId });
}

export const logFixCountForAccount = (
    accountId: string,
    accountName: string,
    count: number
): void => {
    totalFixes += count;
    fixesPerAccount.push({ accountName, count, accountId });
    console.log("Fixed ", count, "items for account ", accountName);
}

export const printLogs = (): void => {
    console.log(JSON.stringify(logs));

    fixesPerAccount.forEach(fix => {
        if (fix.count === 0) return;
        console.log("Fixed ", fix.count, "items for account ", fix.accountName, fix.accountId);
    })
    
    console.log("\n\n")
    console.log("Total fixes: ", totalFixes);
    console.log("\n\n")
}