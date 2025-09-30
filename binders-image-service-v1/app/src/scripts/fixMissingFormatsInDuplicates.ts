/* eslint-disable no-console */
import * as chalk from "chalk";
import * as readline from "readline";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    MongoBinderVisualRepository,
    MongoBinderVisualRepositoryFactory
} from "../api/repositories/binderVisualRepository";
import { VideoIdentifier, Visual } from "../api/model";
import { confirm, panic } from "@binders/client/lib/util/cli";
import { existsSync, readFileSync } from "fs";
import { splitEvery, zip } from "ramda";
import {
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { inspect } from "util";
import mongoose from "mongoose";
import { processAll } from "../helper/batchProcess";

const { bold, gray: fgDimmed, green: fgGreen, red: fgRed, yellow: fgYellow } = chalk;

const warn = (msg: string) => console.log(fgYellow(msg));
const err = (msg: string) => console.log(fgRed(msg));
const ok = (msg: string) => console.log(fgGreen(msg));
const log = (msg = "") => console.log(msg);
const debug = (errorObject: unknown) => inspect(errorObject, { showHidden: false, depth: null, colors: false });
const debugVar = (name: string, value: unknown) => console.log(fgDimmed(`${name} =`), bold(fgDimmed(debug(value))));

const SCRIPT_NAME = "fixMissingFormatsInDuplicates";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script repairs missing formats in videos in duplicated binders based on their original")
    .option("--accountId [accountId]", "Limit queries to specified Account")
    .option("--binderId [binderId]", "Limit queries to specified Binder")
    .option("--visualId [visualId]", "Limit queries to specified Visual")
    .option("--json-file [path]", "Path to a JSON file containing an array of visuals to be processed. Type { visualId: string }[]")
    .option("--json-stdin", "Read the JSON file from stdin")
    .option("--no-color", "If set, will not output colors (handled automatically by chalk)")
    .option("--no-confirm", "If set, will not ask for confirmation")
    .option("-d, --dry-run", "If set, will not change any data")

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
        filters = filters.map(filter => (
            {
                ...filter,
                imageId: mongoose.trusted({ $regex: /^vid-/ }),
                formats: mongoose.trusted({ $size: 1 }),
                originalVisualData: mongoose.trusted({ $exists: true })
            }
        ))
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

    await processVideos(filters);

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
    visualRepo: MongoBinderVisualRepository,
) => {
    return async (visual: Visual) => {
        const visualId = visual.id.value();
        log(bold(`==> Processing ${visualId}`));
        try {
            const originalVisual = await visualRepo.getVisual(
                visual.originalVisualData.binderId,
                VideoIdentifier.parse(visual.originalVisualData.originalId),
            );
            visual.formats = originalVisual.formats;

            const savedVisual = options.dryRun ?
                visual :
                await visualRepo.saveVisual(visual);

            if (savedVisual) {
                succeededVideoIds.push(visualId);
            } else {
                failedVideoIds.push(visualId);
            }
        } catch (ex) {
            err(debug(ex));
            failedVideoIds.push(visualId);
        } finally {
            log();
        }
    }
}

async function processVideos(queries: unknown[]) {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
    const visualRepo = await getImageRepository();
    const processVideo = processVideoBuilder(visualRepo);
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
