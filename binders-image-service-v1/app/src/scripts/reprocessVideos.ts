/* eslint-disable no-console */
import { ReprocessPolicy, reprocessVisual, shouldReprocess } from "../processing/reprocess";
import { Visual, isVideo } from "../api/model";
import { getExtraWebrequestProps, getImageServiceBuilder } from "../api/config";
import {
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import mongoose from "mongoose";
import { processAll } from "../helper/batchProcess";
import { splitEvery } from "ramda";

const SCRIPT_NAME = "reprocess-videos";

interface ScriptOptions {
    query: {
        accountId?: string;
        binderId?: string;
        imageId?: string;
    };
    reprocessPolicy?: string;
    dryRun?: boolean;
}

const getOptions = (): ScriptOptions => {
    const scope = process.argv[2];
    const reprocessPolicy = process.argv[3];
    const flags = process.argv.slice(4);

    if (
        !scope ||
        !(Object.keys(ReprocessPolicy).includes(reprocessPolicy))
    ) {
        console.error(`usage: reprocessVideos.js <scope> <reprocessPolicy> [--dry-run] where reprocessPolicy one of: ${Object.keys(ReprocessPolicy).join(", ")}`);
        process.exit(1);
    }

    const options: Partial<ScriptOptions> = {
        reprocessPolicy,
        dryRun: flags.includes("--dry-run"),
    }

    if (scope.startsWith("aid-")) {
        options.query = { accountId: scope };
    } else if (scope.startsWith("vid-") || scope.startsWith("img-")) {
        options.query = { imageId: scope };
    } else {
        options.query = { binderId: scope };
    }

    return options as ScriptOptions;
}

const buildFiltersForAccount = async (accountId) => {

    const config = BindersConfig.get();
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    const binderIds = await repoServiceClient.findBinderIdsByAccount(accountId);
    const batches = splitEvery(100, binderIds);
    return batches.map(binderIdBatch => (
        { binderId: mongoose.trusted({ $in: binderIdBatch.map(String) }) }
    ));
}

const getMongoQueries = async (query) => {
    if (query.binderId || query.imageId) {
        return [query];
    }
    if (query.accountId) {
        return buildFiltersForAccount(query.accountId);
    }
    throw new Error(`Don't know how to build filter: ${JSON.stringify(query)}`);
}

const config = BindersConfig.get();

const succeededVideoIds = [];
const failedVideoIds = [];
const skippedVideoIds = [];
let isDryRun;

const processVideoBuilder = (builder, logger, options) => {
    return async (visual: Visual) => {
        if (!isVideo(visual)) {
            console.log(`Skipping visual ${visual.id.value()} (not a video)`);
            return;
        }
        const {
            logoStorage,
            imageStorage
        } = getExtraWebrequestProps(builder, config, { logger });

        const service = builder.buildRequestless(logoStorage, logger, imageStorage);

        try {
            const reprocessOptions = {
                includeStreaming: true,
                reprocessPolicy: ReprocessPolicy[options.reprocessPolicy],
                dryRun: options.dryRun,
            };
            const should = await shouldReprocess(visual, service, reprocessOptions, logger);
            const wasReprocessed = should ?
                await reprocessVisual(
                    visual,
                    service,
                    reprocessOptions,
                ) :
                false;

            if (wasReprocessed) {
                succeededVideoIds.push(visual.id.value());
            } else {
                skippedVideoIds.push(visual.id.value());
            }
        } catch (e) {
            console.error(e);
            failedVideoIds.push(visual.id.value());
        }
    }
}

const processVideos = async (queries, options) => {
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const builder = await getImageServiceBuilder(config);
    const processVideo = processVideoBuilder(builder, logger, options);
    for (const query of queries) {
        console.log(`Processing query: ${JSON.stringify(query)}`);
        await processAll(config, logger, processVideo, query);
    }
}

const doIt = async () => {
    const options = getOptions();
    isDryRun = options.dryRun;
    const filters = await getMongoQueries(options.query);
    console.log("filters", filters);
    await processVideos(filters, options);
}

doIt().then(
    () => {
        console.log(`All done!\n${isDryRun ? "Would-be-processed" : "Succeeded"} videoIds: ${succeededVideoIds}\nFailed ones: ${failedVideoIds}\nSkipped ones: ${skippedVideoIds}`);
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)
