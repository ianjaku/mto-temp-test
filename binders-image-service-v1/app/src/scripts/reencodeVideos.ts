/* eslint-disable no-console */
import * as chalk from "chalk";
import * as readline from "readline";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    MongoBinderVisualRepository,
    MongoBinderVisualRepositoryFactory
} from "../api/repositories/binderVisualRepository";
import { ReprocessPolicy, reprocessVisual, shouldReprocess } from "../processing/reprocess";
import { Video, Visual, isVideo } from "../api/model";
import { confirm, panic } from "@binders/client/lib/util/cli";
import { existsSync, readFileSync } from "fs";
import { getExtraWebrequestProps, getImageServiceBuilder } from "../api/config";
import { splitEvery, zip } from "ramda";
import AzureClient from "../storage/azure/AzureClient";
import {
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { ImageServiceBuilder } from "../api/service";
import { VideoFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";
import { inspect } from "util";
import mongoose from "mongoose";
import { processAll } from "../helper/batchProcess";

const { bold, gray: fgDimmed, green: fgGreen, red: fgRed, yellow: fgYellow } = chalk;

const warn = (msg: string) => console.log(fgYellow(msg));
const err = (msg: string) => console.log(fgRed(msg));
const ok = (msg: string) => console.log(fgGreen(msg));
const log = (msg = "") => console.log(msg);
const dim = (msg: string) => console.log(fgDimmed(msg));
const debug = (errorObject: unknown) => inspect(errorObject, { showHidden: false, depth: null, colors: false });
const debugVar = (name: string, value: unknown) => console.log(fgDimmed(`${name} =`), bold(fgDimmed(debug(value))));

const SCRIPT_NAME = "reencodeVideos";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("Re-encode videos")
    .option("--policy <policy>", `Reprocessing policy. One of ${Object.keys(ReprocessPolicy).join(" ")}`)
    .option("--accountId [accountId]", "Limit queries to specified Account")
    .option("--binderId [binderId]", "Limit queries to specified Binder")
    .option("--visualId [visualId]", "Limit queries to specified Visual")
    .option("--json-file [path]", "Path to a JSON file containing an array of visuals to be processed. Type { visualId: string }[]")
    .option("--json-stdin", "Read the JSON file from stdin")
    .option("--no-color", "If set, will not output colors (handled automatically by chalk)")
    .option("--no-confirm", "If set, will not ask for confirmation")
    .option("--nuke-formats", "If set, will erase all formats except the original")
    .option("-d, --dry-run", "If set, will not change any data")
    .option("-q, --quiet", "If set, will not print debugging info");

program.parse(process.argv);
const options: ScriptOptions = program.opts();

if (!options.quiet) {
    debugVar("options", options);
}

const succeededVideoIds = [];
const failedVideoIds = [];
const skippedVideoIds = [];
const visualBinderAccountMap = new Map<string, { accountId: string, binderId: string }>();

type ScriptOptions = {
    accountId?: string;
    binderId?: string;
    confirm?: boolean;
    dryRun?: boolean;
    jsonFile?: string;
    jsonStdin?: string;
    nukeFormats?: boolean;
    policy?: string;
    quiet?: boolean;
    visualId?: string;
};

type ReprocessQuery = {
    accountId?: string;
    binderId?: string;
    imageId?: string;
}

const doIt = async () => {
    const hasFilter = options.accountId || options.binderId || options.visualId;
    const hasJson = options.jsonFile || options.jsonStdin;
    if (options.jsonStdin && options.confirm) panic("When reading JSON from stdin, option --no-confirm must be set");
    if (!hasFilter && !hasJson) panic("At least one of --accountId, --binderId, --visualId, or --json-file, --json-stdin is required");
    if (!options.policy) panic("Option --policy is required");
    if (!Object.keys(ReprocessPolicy).includes(options.policy)) {
        panic(`Invalid policy ${options.policy}\n\n${bold("Accepted values:")}\n\n${Object.keys(ReprocessPolicy).join("\n")}\n`)
    }
    if (options.jsonFile && !existsSync(options.jsonFile)) panic(`JSON file ${options.jsonFile} does not exist`);

    let filters = [];
    if (hasJson) {
        let visualsJson = [];
        if (options.jsonFile) {
            log(`==> Loading JSON from ${options.jsonFile}`);
            visualsJson = JSON.parse(readFileSync(options.jsonFile).toString());
        } else if (options.jsonStdin) {
            log("==> Loading JSON from stdin");
            visualsJson = JSON.parse(await readStdin());
        }
        log(`==> Loaded ${visualsJson.length} records`);
        const visualIds = visualsJson.map(v => v.visualId);
        if (visualIds.find(a => !a)) panic("Some visualIds are missing");
        const visualRepo = await getImageRepository();
        const binderIds = await visualRepo.getBinderIdsForVisualIds(visualIds);
        const accountIdsMap = await findAccountIdsForBinderIds(binderIds);
        for (const [visualId, binderId] of zip(visualIds, binderIds)) {
            const accountId = accountIdsMap[binderId];
            if (!binderId) {
                warn(`Couldn't find binder ID for visual ${visualId}`);
                continue
            }
            if (!accountId) {
                warn(`Couldn't find account ID for ${binderId}`);
                continue
            }
            visualBinderAccountMap.set(visualId, { accountId, binderId });
        }
        filters = [...visualBinderAccountMap.entries()]
            .map(([imageId, { binderId }]) => ({ imageId, binderId }));
    } else {
        filters = await getMongoQueries({
            ...(options.accountId ? { accountId: options.accountId } : {}),
            ...(options.binderId ? { binderId: options.binderId } : {}),
            ...(options.visualId ? { imageId: options.visualId } : {}),
        });
    }

    if (!options.quiet) debugVar("filters", filters);

    if (options.dryRun) {
        log(fgGreen(bold("==> This is a dry run")))
    } else {
        log(fgYellow(bold("==> This is NOT a dry run")))
    }

    if (options.confirm) {
        if (!await confirm(bold("Do you want to continue?"))) {
            panic("Aborting");
        }
    } else {
        log("==> Skipping confirmation");
    }

    await processVideos(filters, options);

    log();
    log(bold(`==> ${options.dryRun ? "Would-be-processed" : "Succeeded"} visualIds (${succeededVideoIds.length}):`));
    ok(succeededVideoIds.length ? succeededVideoIds.join("\n") : fgDimmed("none"));
    log();
    log(bold(`==> Skipped visualIds (${skippedVideoIds.length}):`));
    warn(skippedVideoIds.length ? skippedVideoIds.join("\n") : fgDimmed("none"));
    log();
    log(bold(`==> Failed visualIds (${failedVideoIds.length}):`));
    err(failedVideoIds.length ? failedVideoIds.join("\n") : fgDimmed("none"));
    log();
}

const processVideoBuilder = (
    builder: ImageServiceBuilder,
    visualRepo: MongoBinderVisualRepository,
    logger: Logger,
    options: ScriptOptions,
) => {
    const config = BindersConfig.get();
    const azureClientV2 = new AzureClient(
        logger,
        config.getString("azure.blobs.videos-v2.account").get(),
        config.getString("azure.blobs.videos-v2.accessKey").get(),
    );

    return async (visual: Visual) => {
        const visualId = visual.id.value();
        log(bold(`==> Processing ${visualId}`));
        if (!isVideo(visual)) {
            dim(`    Skipping visual ${visualId} (not a video)\n`);
            return;
        }
        const {
            logoStorage,
            imageStorage,
        } = getExtraWebrequestProps(builder, config, { logger });
        try {
            const service = builder.buildRequestless(logoStorage, logger, imageStorage);

            let visualToProcess = visual;
            let visualIdInfo = visualId;
            if (visual.originalVisualData?.originalId) {
                visualToProcess = await service.loadVisual(
                    visual.originalVisualData.binderId,
                    visual.originalVisualData.originalId
                ) as Video;
                visualIdInfo = `${visualToProcess.id.value()} (which is the original of: ${visualId})`;
                log(`==> Use original video ${visualToProcess.id.value()} - use this for reprocessing`);
            }
            const visualIdToProcess = visualToProcess.id.value();

            const containerExists = await azureClientV2.containerExists(visualIdToProcess);
            const originalExists = await azureClientV2.fileExists(visualIdToProcess, "ORIGINAL");
            const original = visualToProcess.formats.find(f => f.format === VideoFormatType.ORIGINAL);

            if (containerExists && !originalExists) {
                throw new Error(`Error while processing visual ${visualIdInfo} - container exists, but the ORIGINAL file does not`);
            }
            if (!options.dryRun && !originalExists) {
                await imageStorage.withLocalCopy(visualToProcess, VideoFormatType.ORIGINAL, async (localCopy) => {
                    const addedFile = await imageStorage.addFile(
                        localCopy.path,
                        visualToProcess.binderId,
                        visualToProcess.id,
                        visualToProcess.mime,
                        VideoFormatType.ORIGINAL,
                        undefined,
                    );
                    visualToProcess.formats = [
                        {
                            durationInMs: original.durationInMs,
                            format: original.format,
                            size: original.size,
                            width: original.width,
                            height: original.height,
                            hasAudio: original.hasAudio,
                            videoCodec: original.videoCodec,
                            audioCodec: original.audioCodec,
                            storageLocation: addedFile.format.storageLocation,
                            container: addedFile.format.container,
                        },
                    ];
                    await visualRepo.saveVisual(visualToProcess);
                });
            }

            const reprocessOptions = {
                includeStreaming: true,
                reprocessPolicy: ReprocessPolicy[options.policy],
                dryRun: options.dryRun,
            };

            // note: if the visual is a duplicated one, shouldReprocess returns true if the ORIGINAL needs reprocessing
            const should = await shouldReprocess(visual, service, reprocessOptions, logger);

            if (should && !options.dryRun && options.nukeFormats) {
                if (!original) {
                    throw new Error(`Option --nuke-formats is enabled, but no original format found for ${visualToProcess.id.value()}. Refusing to continue.`);
                }
                if (originalExists && !original.storageLocation.startsWith("video-v2://")) {
                    log(`==> Updating original storage location & container for ${visualToProcess.id.value()}`);
                    visualToProcess.formats = [
                        {
                            format: original.format,
                            durationInMs: original.durationInMs,
                            size: original.size,
                            width: original.width,
                            height: original.height,
                            hasAudio: original.hasAudio,
                            videoCodec: original.videoCodec,
                            audioCodec: original.audioCodec,
                            storageLocation: `video-v2://${visualToProcess.id.value()}/ORIGINAL`,
                            container: visualToProcess.id.value(),
                        }
                    ];
                } else {
                    visualToProcess.formats = [original];
                }
                log(bold("==> Saving nuked formats"));
                await visualRepo.saveVisual(visualToProcess);
            }

            const wasReprocessed = should ?
                await reprocessVisual(visual, service, reprocessOptions) :
                false;

            if (wasReprocessed) {
                succeededVideoIds.push(visualId);
            } else {
                skippedVideoIds.push(visualId);
            }
        } catch (ex) {
            err(debug(ex));
            failedVideoIds.push(visualId);
        } finally {
            log();
        }
    }
}

async function processVideos(queries: unknown[], options: ScriptOptions) {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const builder = await getImageServiceBuilder(config);
    const visualRepo = await getImageRepository();
    const processVideo = processVideoBuilder(builder, visualRepo, logger, options);
    for (const query of queries) {
        log(bold(`==> Processing query: ${JSON.stringify(query)}\n`));
        await processAll(config, logger, processVideo, query);
    }
}

async function findAccountIdsForBinderIds(binderIds: string[]): Promise<Record<string, string>> {
    const config = BindersConfig.get();
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    const binders = await repoServiceClient.findItems(
        { binderIds },
        {
            maxResults: binderIds.length + 2,
            omitContentModules: true,
            includeViews: false,
        },
    )
    return Object.fromEntries(binders.map(b => [b.id, b.accountId]));
}

async function buildFiltersForAccount(accountId: string) {
    const config = BindersConfig.get();
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    const binderIds = await repoServiceClient.findBinderIdsByAccount(accountId);
    const batches = splitEvery(100, binderIds);
    return batches.map(binderIdBatch => (
        { binderId: mongoose.trusted({ $in: binderIdBatch.map(String) }) }
    ));
}

async function getMongoQueries(options: ReprocessQuery) {
    if (options.binderId || options.imageId) {
        return [options];
    }
    if (options.accountId) {
        return buildFiltersForAccount(options.accountId);
    }
    throw new Error(`Don't know how to build filter: ${JSON.stringify(options)}`);
}

const getImageRepository = async () => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption);
    const factory = new MongoBinderVisualRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

async function readStdin(): Promise<string> {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        let inputData = "";
        rl.on("line", (line) => {
            inputData += line + "\n";
        });
        rl.on("close", () => {
            resolve(inputData);
        });
    })
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
