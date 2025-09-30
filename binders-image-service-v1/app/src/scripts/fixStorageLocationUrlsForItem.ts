/* eslint-disable no-console */
import { ImageService, ImageServiceBuilder } from "../api/service";
import { getExtraWebrequestProps, getImageServiceBuilder } from "../api/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoBinderVisualRepository } from "../api/repositories/binderVisualRepository";
import { Query } from "@binders/binders-service-common/lib/mongo/repository";
import { Visual } from "../api/model";
import { VisualDAO } from "../api/repositories/contract";
import { log } from "@binders/binders-service-common/lib/util/process";
import mongoose from "mongoose";
import { processAll } from "../helper/batchProcess";
import { replaceStorageAccountInStorageLocation } from "../helper/storageLocation";

const SCRIPT_NAME = "fix-storage-location-urls";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);

const buildMongoQueryForAzureImages = (itemId: string) => {
    return {
        imageId: mongoose.trusted({
            $regex: /^img-.*/
        }),
        binderId: itemId,
        $where: "this.formats[0].storageLocation.startsWith('azure')"
    } as Query<VisualDAO>;
}

function processVisualBuilder(config: BindersConfig, builder: ImageServiceBuilder, dryRun: boolean) {
    return async (visual: Visual, i: number) => {
        log(`Processing visual ${i}`);
        const {
            logoStorage,
            imageStorage,
        } = getExtraWebrequestProps(builder, config, { logger });
        const service: ImageService = builder.buildRequestless(logoStorage, logger, imageStorage);
        const visualId = visual.id.value()
        const oldStorageAccount = "visuals"
        const newStorageAccount = getVisualsStorageAccount()
        const replaceFormats = replaceStorageAccountInStorageLocation(visual.formats, oldStorageAccount, newStorageAccount)
        if (!dryRun) {
            try {
                await service.patchVisual(visual.binderId, visualId, {
                    replaceFormats
                })
            } catch (error) {
                log(`Error when processing visual ${visualId}, binderId ${visual.binderId}`)
                log(error)
            }
        } else {
            log(JSON.stringify(replaceFormats))
            Promise.resolve()
        }
    }
}

function getVisualsStorageAccount(): string {
    const maybeImagesConfig = config.getObject("azure.blobs.images");
    if (maybeImagesConfig.isNothing()) {
        throw new Error("Missing config values for azure.blobs.images");
    }
    const imagesConfig = maybeImagesConfig.get() as { account: string }
    return imagesConfig.account
}

// const getOptions = () => {
//     if (process.argv[2] === "full" || process.argv[2] === undefined) {
//         return {
//             dryRun: process.argv[2] === undefined,
//         }
//     } else {
//         log(`Usage for dry run: node ${__filename}`);
//         log(`Usage for full run: node ${__filename} full`);

//         process.exit(1);

//     }
// }

const getOptions = () => {
    if (process.argv.length < 3) {
        console.error(`Usage: node ${__filename} <item_id> <full?>`);
        process.exit(1);
    }
    return {
        itemId: process.argv[2],
        dryRun: process.argv.length < 4 || process.argv[3] !== "full",
    };
}

const doIt = async () => {
    const { itemId, dryRun } = getOptions()
    const timeoutMs = 300000
    const builder = await getImageServiceBuilder(config, timeoutMs);
    const repo = builder.getBinderVisualRepo(logger) as MongoBinderVisualRepository;
    const mongoQuery = buildMongoQueryForAzureImages(itemId)
    log("Counting number of visuals to reprocess...")
    const toReprocess = await repo.countVisuals(mongoQuery);
    log(`Number of visuals to reprocess ${toReprocess}`)
    const processVisual = processVisualBuilder(config, builder, dryRun)
    await processAll(config, logger, processVisual, mongoQuery);
}

doIt().then(
    () => {
        log("All done!");
        process.exit(0);
    },
    err => {
        log(err);
        process.exit(1);
    }
)
