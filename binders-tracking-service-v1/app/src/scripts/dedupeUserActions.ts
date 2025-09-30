/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ElasticUserActionsRepository } from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import moment from "moment";

const getOptions = () => {
    const rangeStartArg = process.argv.find((arg) => arg.startsWith("--range-start="));
    const rangeStartStr = rangeStartArg ? rangeStartArg.split("=")[1] : undefined;
    const rangeStart = rangeStartStr ? parseInt(rangeStartStr, 10) : undefined;
    if (!rangeStart || isNaN(rangeStart)) {
        console.log("Missing --range-start=");
        process.exit(1);
    }
    const threeMonthsAgo = moment().subtract(3, "months").valueOf();
    if (rangeStart < threeMonthsAgo) {
        console.log("rangeStart cannot be older than 3 months to avoid elastic melting");
        process.exit(1);
    }

    return {
        dryRun: process.argv.includes("--dry-run"),
        rangeStart,
    };
};

function getUserActionsRepo() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, "delete-useractions");
    return new ElasticUserActionsRepository(config, logger);
}

(async function () {
    const { dryRun, rangeStart } = getOptions();
    const userActionsRepo = getUserActionsRepo();
    const report = await userActionsRepo.detectDuplicateUserActions(rangeStart);
    console.log("Report:");
    console.log(JSON.stringify(report, null, 2));
    if (!dryRun && Object.keys(report).length) {
        console.log("Deduping...");
        await userActionsRepo.dedupeUserActions(report);
    }
    console.log("All done!");
    process.exit(0);
})();
