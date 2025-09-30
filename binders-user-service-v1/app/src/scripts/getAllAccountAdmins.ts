import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { differenceInDays } from "date-fns";
import { isManualToLogin } from "@binders/client/lib/util/user";
import { main } from "@binders/binders-service-common/lib/util/process"
import { writeFileSync } from "fs";

const SCRIPT_NAME = "getAllAccountAdmins";
const CSV_FILE = "/tmp/activeAccountAdmins.csv";
const ONLINE_INTERVAL = 100;
const config = BindersConfig.get();

/* eslint-disable no-console */

const getClients = async () => {
    const accountClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const azClient = await BackendAuthorizationServiceClient.fromConfig(config, SCRIPT_NAME);
    const userClient = await BackendUserServiceClient.fromConfig(config, SCRIPT_NAME);
    return {
        accountClient,
        azClient,
        userClient
    }
}

main( async() => {
    const { accountClient, azClient, userClient } = await getClients();
    const allAccounts = await accountClient.listAccounts();
    const now = new Date();
    console.log(allAccounts.length, " accounts ");
    const csvRows = ["ACCOUNT_ID;ACCOUNT_NAME;USER_LOGIN;USER_NAME;USER_LASTONLINE"];
    for (const account of allAccounts) {
        if (!account.accountIsNotExpired) {
            console.log(`------- Skipping account ${account.name} (EXPIRED)`);
            continue;
        }
        const adminUserIds = await azClient.getAccountAdmins(account.id);
        const adminGroupId = await azClient.getAdminGroup(account.id);
        const { members: adminGroupMembers } = await userClient.getGroupMembers(account.id, adminGroupId, {maxResults: 1000});
        const directAdminUsers = await userClient.findUserDetailsForIds(adminUserIds);
        const adminUsers = [
            ...directAdminUsers,
            ...adminGroupMembers
        ];
        console.log(`------- Processing ${adminUsers.length} admins for ${account.name}`);
        for (const adminUser of adminUsers) {
            if (isManualToLogin(adminUser.login)) {
                console.log(`Ignoring manual.to user ${adminUser.login}`);
                continue;
            }
            if (!adminUser.lastOnline) {
                console.log(`Ignoring user ${adminUser.login}. No last online.`);
                continue;
            }
            const lastOnline = new Date(adminUser.lastOnline);
            const lastSeenDaysAgo = differenceInDays(now, lastOnline);
            if (lastSeenDaysAgo > ONLINE_INTERVAL) {
                console.log(`Ignoring user ${adminUser.login}. Not seen the last ${ONLINE_INTERVAL} days`);
                continue;
            }
            console.log(`Found user ${adminUser.login} in ${account.name}`);
            csvRows.push([
                account.id,
                account.name,
                adminUser.login,
                adminUser.displayName,
                adminUser.lastOnline
            ].join(";"));
        }
    }
    const fileContents = csvRows.join("\n");
    writeFileSync(CSV_FILE, fileContents)
})