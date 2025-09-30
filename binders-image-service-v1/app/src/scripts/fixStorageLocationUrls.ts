import { ImageService, ImageServiceBuilder } from "../api/service";
import { getExtraWebrequestProps, getImageServiceBuilder } from "../api/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
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

const buildMongoQueryForAzureImages = () => {
    return {
        imageId: mongoose.trusted({
            $regex: /^img-.*/
        }),
        $where: "this.formats[0].storageLocation.startsWith('azure')"
    } as Query<VisualDAO>;
}

function processVisualBuilder(config: BindersConfig, builder: ImageServiceBuilder, dryRun: boolean) {
    const {
        logoStorage,
        imageStorage,
    } = getExtraWebrequestProps(builder, config, { logger });
    const service: ImageService = builder.buildRequestless(logoStorage, logger, imageStorage);
    const oldStorageAccount = "visuals"
    const regex = new RegExp("azure://" + oldStorageAccount + "/", "g")
    return async (visual: Visual, i: number) => {
        if (regex.test(visual.formats[0].storageLocation)) {
            log(`Processing visual ${i}`);
            const visualId = visual.id.value()
            const newStorageAccount = getVisualsStorageAccount()
            log(JSON.stringify(visual.formats))
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
                Promise.resolve()
            }
        } else {
            if (i % 10000 == 0) {
                log(`Not matching visual ${i}`);
            }
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

const getOptions = () => {
    if (process.argv[2] === "full" || process.argv[2] === undefined) {
        return {
            dryRun: process.argv[2] === undefined,
        }
    } else {
        log(`Usage for dry run: node ${__filename}`);
        log(`Usage for full run: node ${__filename} full`);

        process.exit(1);

    }
}

const doIt = async () => {
    const { dryRun } = getOptions()
    const timeoutMs = 900000
    const builder = await getImageServiceBuilder(config, timeoutMs);
    // const repo = builder.getRepo(logger) as MongoBinderVisualRepository;
    const mongoQuery = buildMongoQueryForAzureImages()
    // log("Counting number of visuals to reprocess...")
    // const toReprocess = await repo.countVisuals(mongoQuery);
    // log(`Number of visuals to reprocess ${toReprocess}`)
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
