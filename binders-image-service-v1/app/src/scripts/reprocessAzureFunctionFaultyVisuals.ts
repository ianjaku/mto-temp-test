/* eslint-disable no-console */
import * as fs from "fs";
import { ReprocessPolicy, reprocessVisual, shouldReprocess } from "../processing/reprocess";
import { Visual, isVideo } from "../api/model";
import { getExtraWebrequestProps, getImageServiceBuilder } from "../api/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import mongoose from "mongoose";
import { processAll } from "../helper/batchProcess";

const SCRIPT_NAME = "reprocess-azure-function-faulty-videos";
const config = BindersConfig.get();

const succeededVideoIds = [];
const failedVideoIds = [];
const skippedVideoIds = [];
const affectedAzureContainers = {}

const getImageService = (builder, logger) => {
    const {
        logoStorage,
        imageStorage
    } = getExtraWebrequestProps(builder, config, { logger });
    return builder.buildRequestless(logoStorage, logger, imageStorage);
}

const processVideoBuilder = (builder, logger, options) => {
    return async (visual: Visual) => {
        if (!isVideo(visual)) {
            console.log(`Skipping visual ${visual.id.value()} (not a video)`);
            return;
        }
        const service = getImageService(builder, logger)
        try {
            const reprocessOptions = {
                reprocessPolicy: options.force ? ReprocessPolicy.FORCE_ALL : ReprocessPolicy.MISSING,
                includeStreaming: true,
            };
            const should = await shouldReprocess(visual, service, reprocessOptions, logger);
            const wasReprocessed = should ?
                await reprocessVisual(
                    visual,
                    service,
                    logger,
                ) :
                false;
            if (wasReprocessed) {
                succeededVideoIds.push(visual.id.value());
                const containerIds = visual.formats.map(format => format.container)
                containerIds.forEach(containerId => {
                    affectedAzureContainers[containerId] = true
                })
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

const getFilters = (startDate: Date = undefined, endDate: Date = undefined) => {
    return [{
        created: {
            ...(startDate && mongoose.trusted({ $gte: startDate.toISOString() })),
            ...(endDate && mongoose.trusted({ $lte: endDate.toISOString() }))
        }
    }]
}

const dumpFile = async (path: string, content): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(path, content, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
};

// eslint-disable-next-line @typescript-eslint/ban-types
const dumpJSON = async (data: Object, filePath: string, pretty?: boolean) => {
    const jsonData = pretty ?
        JSON.stringify(data, undefined, 4) :
        JSON.stringify(data);
    await dumpFile(filePath, jsonData);
}

const doIt = async () => {
    const startDate = new Date("2021-09-25 21:29:29.529Z")
    const endDate = new Date("2021-09-30 21:33:07.230Z")
    const filters = getFilters(startDate, endDate)
    const options = { force: true }
    await processVideos(filters, options);
    if (Object.keys(affectedAzureContainers).length > 0) {
        dumpJSON(affectedAzureContainers, "/tmp/affectedAzureContainers.json")
    }
}

doIt().then(
    () => {
        console.log(`All done!\nSucceeded videoIds: ${succeededVideoIds}\nFailed ones: ${failedVideoIds}\nSkipped ones: ${skippedVideoIds}`);
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)
