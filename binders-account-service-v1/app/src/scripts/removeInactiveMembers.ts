import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { log, main } from "@binders/binders-service-common/lib/util/process";
import { maybeParseFormatted, maybeParseISO } from "@binders/client/lib/date/maybeDateFns";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Maybe } from "@binders/client/lib/monad";
import { differenceInDays } from "date-fns";
import { getChar } from "@binders/binders-service-common/lib/util/stdin";
import { splitEvery } from "ramda";


const config = BindersConfig.get();
const SCRIPTNAME = "runExpiringAccountsReport";

const program = new Command();

program
    .name(SCRIPTNAME)
    .description("Remove members from an account that have not logged in since a certain time/period.")
    .version("0.1.1")
    .option("-d, --dry", "just print the members that would be removed")
    .option("-a, --account [accountId]", "the account that needs to be cleaned")
    .option("-s, --since [date]", "the date since which members have not logged in (eg. 2020-01-01)")

function getOptions() {
    program.parse(process.argv);
    const options = program.opts();
    const { account, dry, since } = options;

    if (!account) {
        throw new Error("account is required");
    }
    if (!since) {
        throw new Error("missing since date");
    }
    const parsedDate = maybeParseFormatted(since, "yyyy-MM-dd");
    if (parsedDate.isNothing()) {
        throw new Error("since is not a valid date (yyyy-MM-dd)");
    }
    const now = new Date();
    const sinceDate = parsedDate.get();
    const daysSince = differenceInDays(now, sinceDate);
    if (daysSince < 60) {
        throw new Error(`since date must be at least 60 days in the past: ${daysSince} days`);
    }

    const sinceInMs = sinceDate.getTime();
    return {
        account,
        since,
        sinceInMs,
        dry
    };
}

async function getClients() {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPTNAME);
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, SCRIPTNAME);
    return { accountServiceClient, userServiceClient };
}

main(async() => {
    const { accountServiceClient, userServiceClient } = await getClients();
    const { account, since, sinceInMs, dry } = getOptions();
    const { name, members } = await accountServiceClient.getAccount(account);
    const usersToRemove = [];
    const memberChunks = splitEvery(100, members);
    for (const memberChunk of memberChunks) {
        const users = await userServiceClient.getUsers(memberChunk);
        const inactiveUsers = users.filter(user => {

            const maybeLastOnline = user.lastOnline instanceof Date ?
                Maybe.just(user.lastOnline) :
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                maybeParseISO(user.lastOnline as any);
            const lastOnline = maybeLastOnline
                .lift(lo => lo.getTime())
                .getOrElse(0);
            return lastOnline < sinceInMs;
        });
        usersToRemove.push(...inactiveUsers);
    }
    const memberCountToRemove = usersToRemove.length;
    if (memberCountToRemove == 0) {
        log(`No inactive users found since ${since} in account ${name}`);
        return;
    }
    log(`Found ${memberCountToRemove} inactive out of a total of ${members.length} users since ${since} in account ${name}`);
    const response = await getChar("Do you want to remove them (y/*)?");
    if (response !== "y") {
        log("Aborting");
        return;
    }
    let progress = 1;
    const usersToRemoveChunks = splitEvery(100, usersToRemove);
    for (const usersToRemoveChunk of usersToRemoveChunks) {
        for (const userToRemove of usersToRemoveChunk) {
            const progressInfo = `[${progress}/${memberCountToRemove}] `;
            progress++;
            const removalMessage = `Removing user ${userToRemove.login} from account ${name} (last online: ${userToRemove.lastOnline})`;
            log(`${progressInfo}${dry ? "dryrun - " : ""}${removalMessage}`);
        }
        if (!dry) {
            const userIdsToRemove = usersToRemoveChunk.map(u => u.id);
            await accountServiceClient.removeMembers(account, userIdsToRemove, ManageMemberTrigger.INACTIVE_USER_EXPIRATION);
        }
    }
});