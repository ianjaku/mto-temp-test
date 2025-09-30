/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    MongoBinderVisualRepository,
    MongoBinderVisualRepositoryFactory
} from "../api/repositories/binderVisualRepository";
import {
    MongoVisualProcessingJobsRepository,
    MongoVisualProcessingJobsRepositoryFactory
} from "../api/repositories/visualProcessingJobsRepository";
import {
    ProcessingStep,
    VisualStatus
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { Config } from "@binders/client/lib/config/config";
import { Visual } from "../api/model";
import { subDays } from "date-fns";

/**
 * MT-4853
 * This is a one-off script to unstuck videos that are stuck in "processing" state. (status "processing" in images collection)
 * Future videos that get stuck are handled by the cronjob restart-stuck-video-processing-jobs
**/

const log = (msg = "") => console.log(msg);
const err = (msg: string) => console.error(msg);

const SCRIPT_NAME = "reprocessStuckVideos";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("Reprocess stuck videos")
    .option("-d, --dry-run", "If set, will not change any data")
    .option("-l, --limit [number]", "Cap the number of videos to reprocess")

type ScriptOptions = {
    dryRun?: boolean;
    limit?: number;
};

program.parse(process.argv);
const options: ScriptOptions = program.opts();

const doIt = async () => {
    if (options.dryRun) {
        log("==> This is a dry run");
    }
    await reprocessStuckVideos();
}

const getBinderVisualRepository = async (config: Config, logger: Logger): Promise<MongoBinderVisualRepository> => {
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption);
    const factory = new MongoBinderVisualRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

const getVisualProcessingJobsRepository = async (config: Config, logger: Logger): Promise<MongoVisualProcessingJobsRepository> => {
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "visualProcessingJobs", loginOption);
    const factory = new MongoVisualProcessingJobsRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

const getRepoServiceClient = (config: Config): Promise<BinderRepositoryServiceClient> => {
    return BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
}

const getAccountServiceClient = (config: Config): Promise<AccountServiceClient> => {
    return BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
}

async function reprocessStuckVideos() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const binderVisualRepo = await getBinderVisualRepository(config, logger);
    const visualProcessingJobsRepo = await getVisualProcessingJobsRepository(config, logger);
    const repoServiceClient = await getRepoServiceClient(config);
    const accountServiceClient = await getAccountServiceClient(config);
    const allStuckVideos = await binderVisualRepo.findVisuals({
        idRegex: "^vid-",
        statuses: [VisualStatus.ACCEPTED, VisualStatus.PROCESSING, VisualStatus.PROCESSING_BACKGROUND],
        createdBefore: subDays(new Date(), 1),
    });

    let limit = options.limit && parseInt(`${options.limit}`);
    if (!limit || isNaN(limit) || limit < 0) {
        log("==> Using the default limit of 10, a higher limit could use up all video transcoding slots");
        limit = 10;
    }

    // build lookup maps to filter out videos from expired accounts
    const visualIdToBinderIdLookup: Map<string, string> = new Map();
    for (const video of allStuckVideos) {
        visualIdToBinderIdLookup.set(video.id.value(), video.binderId);
    }
    const binderIdsSet = new Set(visualIdToBinderIdLookup.values());
    const binders = binderIdsSet.size === 0 ?
        [] :
        await repoServiceClient.findBindersBackend({ ids: Array.from(binderIdsSet) }, { maxResults: 9999 });
    const binderIdToAccountIdLookup: Map<string, string> = new Map();
    for (const binder of binders) {
        binderIdToAccountIdLookup.set(binder.id, binder.accountId);
    }
    const accountIdSet = new Set(binderIdToAccountIdLookup.values());
    const accounts = await accountServiceClient.findAccountsForIds(Array.from(accountIdSet));

    // Jobs modified in the last 24 hours
    const freshJobsForStuckVideos = await visualProcessingJobsRepo.findJobsWithRestrictions({
        visualIds: allStuckVideos.map(v => v.id.value()),
        createdAfter: subDays(new Date(), 1),
    });
    const freshVideoIdsInJobs = new Set(freshJobsForStuckVideos.map(v => v.visualId));
    // Jobs older than 24 hours
    const staleJobsForStuckVideos = await visualProcessingJobsRepo.findJobsWithRestrictions({
        visualIds: allStuckVideos.map(v => v.id.value()),
        lastUpdatedBefore: subDays(new Date(), 1),
    });
    const staleVideoIdsInJobs = new Set(staleJobsForStuckVideos.map(v => v.visualId));

    const allVideosToReprocess: Array<Visual & { accountId: string }> = [];
    for (const video of allStuckVideos) {
        const binderId = visualIdToBinderIdLookup.get(video.id.value());
        const accountId = binderIdToAccountIdLookup.get(binderId);
        if (!accountId) {
            log(`==> Skipping ${video.id.value()} because no accountId found for binderId ${binderId}`);
            continue;
        }
        const account = accounts.find(a => a.id === accountId);
        if (!account) {
            log(`==> Skipping ${video.id.value()} because no account found for accountId ${accountId}`);
            continue;
        }
        if (new Date(account.expirationDate) < new Date()) {
            log(`==> Skipping ${video.id.value()} because it belongs to an expired account (${account.name}, expired on ${account.expirationDate})`);
            continue;
        }
        if (freshVideoIdsInJobs.has(video.id.value())) {
            log(`==> Skipping ${video.id.value()} because it already has a job in visualProcessingJobsRepo (will be handled by restart-stuck-video-processing-jobs cronjob)`);
            continue;
        }
        if (staleVideoIdsInJobs.has(video.id.value())) {
            log(`==> Removing stale visual processing job for ${video.id.value()} in order to schedule job for reprocessing`);
            if (!options.dryRun) {
                await visualProcessingJobsRepo.deleteJobForVisual(video.id.value());
            }
        }
        allVideosToReprocess.push({
            ...video,
            accountId,
        });
    }

    const videosToReprocess = allVideosToReprocess.slice(0, limit);
    log(`\n\nwill reprocess ${videosToReprocess.length} videos\n\n`);
    for (const videoInfo of videosToReprocess) {
        log(`==> Adding processing job for ${videoInfo.id.value()} for binder ${videoInfo.binderId} from account: ${videoInfo.accountId}`);
        // create a new job into visualProcessingJobsRepo for this, with "FLAGGED_FOR_REPROCESSING" step
        // this will trigger the restart-stuck-video-processing-jobs cronjob to pick it up
        if (!options.dryRun) {
            await visualProcessingJobsRepo.createJobForVisual(
                videoInfo.id.value(),
                ProcessingStep.FLAGGED_FOR_REPROCESSING,
                { accountId: videoInfo.accountId },
            );
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