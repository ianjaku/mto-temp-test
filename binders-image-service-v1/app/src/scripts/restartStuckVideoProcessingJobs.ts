import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    MongoVisualProcessingJobsRepository,
    MongoVisualProcessingJobsRepositoryFactory
} from "../api/repositories/visualProcessingJobsRepository";
import { ProcessingStep, VisualProcessingJob } from "@binders/client/lib/clients/imageservice/v1/contract";
import { BackendImageServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { Config } from "@binders/client/lib/config/config";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { isVideoIdString } from "../api/model";
import { subMinutes } from "date-fns";

const VISUALS_TO_RESTART_PER_SCRIPT_RUN = 10;

// eslint-disable-next-line no-console
const log = (msg = "") => console.log(msg);
// eslint-disable-next-line no-console
const err = (msg: string) => console.error(msg);

const SCRIPT_NAME = "restartStuckVideoProcessingJobs";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("Restart stuck video processing jobs. This script is mostly used by our cronjobs to restart stuck video jobs, but can also be invoked manually")
    .option("--createdAfter [date]", "Limit queries to videos created after the specified date (e.g of valid dates: 2025-07-16 or 2025-07-16T12:42:39.348Z)")
    .option("-l, --limit [number]", "Cap the number of videos to restart, default is 10")
    .option("-d, --dry-run", "If set, will not change any data")

type ScriptOptions = {
    createdAfter?: string;
    limit?: number;
    dryRun?: boolean;
};

const failedVideoIds: string[] = [];

program.parse(process.argv);
const options: ScriptOptions = program.opts();

const resolveCreatedAfter = () => {
    const defaultCreatedAfter = subMinutes(Date.now(), 25);
    if (!options.createdAfter) {
        return defaultCreatedAfter;
    }
    const date = new Date(options.createdAfter);
    if (isNaN(date.getTime())) {
        log(`==> Invalid createdAfter date: ${options.createdAfter}, falling back to default of '25 minutes ago'`);
        return defaultCreatedAfter;
    }
    log(`==> Using provided createdAfter date: ${options.createdAfter}`);
    return date;
}

const resolveLimit = () => {
    if (!options.limit) {
        return VISUALS_TO_RESTART_PER_SCRIPT_RUN;
    }
    const limit = parseInt(`${options.limit}`);
    if (!limit || isNaN(limit) || limit < 0) {
        log(`==> Invalid limit value provided: ${options.limit}. Falling back to the default of ${VISUALS_TO_RESTART_PER_SCRIPT_RUN}`);
        return VISUALS_TO_RESTART_PER_SCRIPT_RUN;
    }
    log(`==> Using provided limit of ${limit}`);
    return limit;
}

const doIt = async () => {
    if (options.dryRun) {
        log("==> This is a dry run");
    }
    await processVideos();

    log();
    log(`==> Failed visualIds (${failedVideoIds.length}):`);
    err(failedVideoIds.length ? failedVideoIds.join("\n") : "none");
    log();
}

const getVisualProcessingJobsRepository = async (config: Config, logger: Logger): Promise<MongoVisualProcessingJobsRepository> => {
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "visualProcessingJobs", loginOption);
    const factory = new MongoVisualProcessingJobsRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

async function processVideos() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const repository = await getVisualProcessingJobsRepository(config, logger);
    const jobs = await repository.findJobsWithRestrictions({
        createdAfter: resolveCreatedAfter(),
        lastUpdatedBefore: subMinutes(Date.now(), 1),
        steps: [ ProcessingStep.PREPROCESSING, ProcessingStep.TRANSCODING, ProcessingStep.FLAGGED_FOR_REPROCESSING ],
        limit: resolveLimit(),
    });

    const imageServiceClient = await BackendImageServiceClient.fromConfig(config, SCRIPT_NAME);
    const processVisualFn = await buildProcessVisualFn(imageServiceClient, options);
    log(`Found (at least) ${jobs.length} stuck visuals`);
    for (const job of jobs) {
        await processVisualFn(job);
    }
}

const buildProcessVisualFn =  async (
    imageServiceClient: ImageServiceClient,
    options: ScriptOptions,
) => {
    return async (job: VisualProcessingJob) => {
        const visualId = job.visualId;
        log(`==> Processing ${visualId}`);
        if (!isVideoIdString(visualId)) {
            log(`    Skipping visual ${visualId} (not a video)\n`);
            return;
        }
        try {
            if (options.dryRun) {
                log(`Would have resumed background processing for ${visualId}`);
                return;
            }
            await imageServiceClient.restartVideoProcessing(job.visualId);
        } catch (ex) {
            err(ex);
            failedVideoIds.push(visualId);
        } finally {
            log();
        }
    }
}

doIt()
    .then(() => {
        log("All done!");
        process.exit(0);
    })
    .catch(e => {
        err(e);
        process.exit(1);
    });