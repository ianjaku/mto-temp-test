/* eslint-disable no-console */
import { LoggerBuilder, debugLog } from "@binders/binders-service-common/lib/util/logging";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { TrackingRepositoryFactory } from "../trackingservice/repositories/eventRepository";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const scriptName = "findEvents";
const program = new Command();

program
    .name(scriptName)
    .description("Find events based on a filter")
    .option("-a, --accountId <accountId>", "The accountId (required)")
    .option("-f, --filter <filter>", "The filter (required)")

interface ParsedOptions {
    accountId: string;
    filter: string;
}

const getOptions = (): ParsedOptions => {
    program.parse(process.argv);
    const opts = program.opts() as { accountId: string; filter: string; };

    if (!opts.accountId) {
        console.error("Error: Account ID is required. Use -a or --accountId");
        process.exit(1);
    }

    if (!opts.filter) {
        console.error("Error: Filter is required. Use -f or --filter");
        process.exit(1);
    }

    return {
        accountId: opts.accountId,
        filter: opts.filter,
    };
}

const getEventsRepository = async () => {
    const trackingRepositoryFactory = await TrackingRepositoryFactory.fromConfig(config, logger);
    return trackingRepositoryFactory.build(logger);
}

async function doIt(): Promise<void> {
    const { accountId, filter } = getOptions();
    const eventsRepo = await getEventsRepository();

    debugLog(`finding events for ${accountId} with filter ${JSON.parse(filter)}`);
    const events = await eventsRepo.findEvents(accountId, JSON.parse(filter));
    console.log(`${events.length} events found`);
    // console.log(JSON.stringify(events, null, 2));
    process.exit(0);
}

(async () => {
    await doIt();
})();
