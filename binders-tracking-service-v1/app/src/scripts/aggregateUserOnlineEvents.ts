/* eslint-disable no-console */
import * as fs from "fs";
import {
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { TrackingRepositoryFactory } from "../trackingservice/repositories/eventRepository";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

/**
 * This script aggregates the USER_IS_ONLINE events into per-user and per-group totals,
 * aggregating as max 1 per user per day
 * group totals are the sum of the members
 * Used for Bekaert Deslee sept '25
 */

const scriptName = "aggregateUserOnlineEvents"
const program = new Command();

program
    .name(scriptName)
    .description("Count logins based on USER_IS_ONLINE events, aggregated as max 1 per user per day. Prints per-user totals and group totals.")
    .option("-a, --account <accountId>", "The account id (required)")
    .option("-f, --from <from>", "The start date (e.g., 2024-01-01 or 2024-01-01T00:00:00Z)")
    .option("-t, --to <to>", "The end date (e.g., 2024-01-31 or 2024-01-31T23:59:59Z)")
    .option("-o, --out <file>", "Write output to the specified CSV file instead of stdout");


interface ParsedOptions {
    accountId: string;
    fromDate: Date;
    toDate: Date;
    outPath?: string;
}

const getOptions = (): ParsedOptions => {
    program.parse(process.argv);
    const opts = program.opts() as { account?: string; from?: string; to?: string; out?: string };
    const fromDate = opts.from ? new Date(opts.from) : undefined;
    const toDate = opts.to ? new Date(opts.to) : undefined;
    if (!opts.account) {
        throw new Error("Missing required --account <accountId>.");
    }
    if (!fromDate || Number.isNaN(fromDate.getTime())) {
        throw new Error("Invalid or missing --from date. Use a parsable date like 2024-01-01 or 2024-01-01T00:00:00Z.");
    }
    if (!toDate || Number.isNaN(toDate.getTime())) {
        throw new Error("Invalid or missing --to date. Use a parsable date like 2024-01-31 or 2024-01-31T23:59:59Z.");
    }
    return {
        accountId: opts.account,
        fromDate,
        toDate,
        outPath: opts.out,
    };
}

const getEventsRepository = async () => {
    const trackingRepositoryFactory = await TrackingRepositoryFactory.fromConfig(config, logger)
    const trackingRepository = trackingRepositoryFactory.build(logger);
    return trackingRepository;
}

const getUserServiceClient = async () => {
    return BackendUserServiceClient.fromConfig(config, scriptName);
}

async function doIt(): Promise<void> {
    const { accountId, fromDate, toDate, outPath } = getOptions();
    const eventsRepo = await getEventsRepository();
    const events = await eventsRepo.findEventsInRange(accountId, {
        range: {
            rangeStart: fromDate,
            rangeEnd: toDate,
            fieldName: "timestamp"
        },
        eventTypes: [EventType.USER_IS_ONLINE],
    });

    type DayString = string;
    const countsByDayThenUser = new Map<DayString, Map<string, number>>();

    for (const event of events) {
        const rawTs = event.timestamp as number | Date;
        let ms;
        if (typeof rawTs === "number") {
            ms = rawTs;
        } else if (rawTs && typeof (rawTs as Date).getTime === "function") {
            ms = (rawTs as Date).getTime();
        }
        if (ms === undefined || Number.isNaN(ms)) {
            console.warn("Invalid timestamp!", event);
            continue;
        }
        const d = new Date(ms);
        const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        const userId = event.userId || "unknown";

        if (!countsByDayThenUser.has(day)) {
            countsByDayThenUser.set(day, new Map<string, number>());
        }
        countsByDayThenUser.get(day).set(userId, (countsByDayThenUser.get(day).get(userId) || 0) + 1);
    }

    const days = Array.from(countsByDayThenUser.keys()).sort();
    const lines = [];

    // Per-user totals across the range (max 1 per day)
    const totalsByUser = new Map<string, number>();
    for (const day of days) {
        const byUser = countsByDayThenUser.get(day);
        for (const user of byUser.keys()) {
            totalsByUser.set(user, (totalsByUser.get(user) || 0) + 1);
        }
    }
    const users = Array.from(totalsByUser.keys()).sort();

    const userServiceClient = await getUserServiceClient();
    const userRecords = await userServiceClient.getUsers(users.filter(u => typeof u === "string" && u.startsWith("uid-")));
    const userIdToLogin = new Map<string, string>();
    userIdToLogin.set("public", "public");
    for (const u of userRecords) {
        userIdToLogin.set(u.id, u.login);
    }

    lines.push("name,count");
    for (const userId of users) {
        const label = userIdToLogin.get(userId) || userId;
        lines.push(`${label},${totalsByUser.get(userId)}`);
    }

    const linkableUsers = users.filter(u => typeof u === "string" && u.startsWith("uid-")); // Exclude public users from group linking
    if (linkableUsers.length > 0) {
        const groupsForUsers = await userServiceClient.getGroupsForUsers(linkableUsers, accountId);
        const totalsByGroupName = new Map<string, number>();
        for (const userId of linkableUsers) {
            const userGroups = groupsForUsers[userId] || [];
            const userTotal = totalsByUser.get(userId) || 0;
            for (const g of userGroups) {
                if (g.accountId && g.accountId !== accountId) continue;
                const groupName = g.name;
                totalsByGroupName.set(groupName, (totalsByGroupName.get(groupName) || 0) + userTotal);
            }
        }
        const groupNames = Array.from(totalsByGroupName.keys()).sort();
        for (const groupName of groupNames) {
            lines.push(`${groupName},${totalsByGroupName.get(groupName)}`);
        }
    }

    if (outPath) {
        fs.writeFileSync(outPath, lines.join("\n"));
        console.log(`Wrote ${lines.length - 1} rows to ${outPath}`);
    } else {
        console.log(lines.join("\n"));
    }

    process.exit(0);
}

(async () => {
    await doIt();
})();

