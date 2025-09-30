/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    MongoBinderVisualRepository,
    MongoBinderVisualRepositoryFactory
} from "../api/repositories/binderVisualRepository";
import { ReprocessPolicy, reprocessVisual } from "../processing/reprocess";
import { confirm, panic } from "@binders/client/lib/util/cli";
import { getExtraWebrequestProps, getImageServiceBuilder } from "../api/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { ImageServiceBuilder } from "../api/service";
import { Video } from "../api/model";
import { VideoFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";
import chalk from "chalk";
import { inspect } from "util";
import { processAll } from "../helper/batchProcess";

const { bold, gray: fgDimmed, green: fgGreen, red: fgRed, yellow: fgYellow } = chalk;

const err = (msg: string) => console.log(fgRed(msg));
const ok = (msg: string) => console.log(fgGreen(msg));
const log = (msg = "") => console.log(msg);
const debug = (errorObject: unknown) => inspect(errorObject, { showHidden: false, depth: null, colors: false });

const SCRIPT_NAME = "fixSkewedVideos";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("Fix skewed videos affected by MT-4928")
    .option("--visualId [visualId]", "Limit queries to specified Visual")
    .option("-d, --dry-run", "If set, will not change any data")

program.parse(process.argv);
const options: ScriptOptions = program.opts();

const succeededVideoIds = [];
const failedVideoIds = [];

type ScriptOptions = {
    dryRun?: boolean;
    visualId?: string;
};

const doIt = async () => {
    if (!options.visualId) {
        panic("--visualId is required");
    }
    if (options.dryRun) {
        log(fgGreen(bold("==> This is a dry run")))
    } else {
        log(fgYellow(bold("==> This is NOT a dry run")))
    }
    if (!await confirm(bold("Are you 100% sure the target video is affected by the bug in MT-4928? (Running the script on other videos will corrupt them). Continue?"))) {
        panic("Aborting");
    }

    await processVideos(options.visualId);

    log();
    log(bold(`==> ${options.dryRun ? "Would-be-processed" : "Succeeded"} visualIds (${succeededVideoIds.length}):`));
    ok(succeededVideoIds.length ? succeededVideoIds.join("\n") : fgDimmed("none"));
    log();
    log(bold(`==> Failed visualIds (${failedVideoIds.length}):`));
    err(failedVideoIds.length ? failedVideoIds.join("\n") : fgDimmed("none"));
    log();
}

const processVideoBuilder = (
    builder: ImageServiceBuilder,
    visualRepo: MongoBinderVisualRepository,
    logger: Logger,
) => {
    const config = BindersConfig.get();

    return async (visual: Video) => {
        const visualId = visual.id.value();
        log(bold(`==> Processing ${visualId}`));
        if (visual.originalVisualData?.originalId) {
            err(`    Skipping visual ${visualId} (is a duplicate video (original ${visual.originalVisualData?.originalId} - script not built for this))\n`);
            return;
        }
        const {
            logoStorage,
            imageStorage,
        } = getExtraWebrequestProps(builder, config, { logger });
        try {
            const service = builder.buildRequestless(logoStorage, logger, imageStorage);
            const visualIdToProcess = visual.id.value();

            // 1. swap width and height of original, nuke other formats
            const original = visual.formats.find(f => f.format === VideoFormatType.ORIGINAL);
            visual.formats = [
                {
                    format: original.format,
                    durationInMs: original.durationInMs,
                    size: original.size,
                    width: original.height, // swapped
                    height: original.width, // swapped
                    hasAudio: original.hasAudio,
                    videoCodec: original.videoCodec,
                    audioCodec: original.audioCodec,
                    storageLocation: original.storageLocation,
                    container: original.container,
                }
            ];
            if (!options.dryRun) {
                await visualRepo.saveVisual(visual);
                ok(`    Visual ${visualIdToProcess} saved`);
            } else {
                ok(`    Visual ${visualIdToProcess} would be saved`);
            }

            // 2. reencode
            const reprocessOptions = {
                includeStreaming: true,
                reprocessPolicy: ReprocessPolicy.FORCE_ALL,
                dryRun: options.dryRun,
                useTranscoderV2: true,
            };
            const wasReprocessed = await reprocessVisual(visual, service, reprocessOptions);
            if (wasReprocessed) {
                succeededVideoIds.push(visualIdToProcess);
            } else {
                failedVideoIds.push(visualIdToProcess);
            }
        } catch (ex) {
            err(debug(ex));
            failedVideoIds.push(visualId);
        } finally {
            log();
        }
    }
}

async function processVideos(visualId: string) {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const builder = await getImageServiceBuilder(config);
    const visualRepo = await getImageRepository();
    const processVideo = processVideoBuilder(builder, visualRepo, logger);
    await processAll(config, logger, processVideo, { imageId: visualId });
}

const getImageRepository = async () => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption);
    const factory = new MongoBinderVisualRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
