import apm from "@binders/binders-service-common/lib/monitoring/apm";
/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line sort-imports
import {
    AccountServiceContract,
    FEATURE_AI_CONTENT_FORMATTING
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendImageServiceClient,
    BackendRepoServiceClient,
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    BindersRepositoryServiceContract,
    DocumentCollection,
    ItemKind
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BinderOperations, createBinder } from "./internal/BinderOperations";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import type {
    ContentServiceContract,
    GenerateManualRequest,
    OptimizeBinderContentRequest,
    OptimizeBinderContentResponse,
    OptimizeChunkContentRequest,
    OptimizeChunkContentResponse
} from "@binders/client/lib/clients/contentservice/v1/contract";
import {
    EventPayload,
    EventType,
    TrackingServiceContract
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { ILlmFileRepository, LlmFileRepositoryFactory } from "./internal/llm-file-repository";
import type { ILlmService, ILlmVideoService, Identity } from "./internal/llm";
import { ILlmStorage, LlmAzureStorage } from "./internal/storage";
import LaunchDarklyService, {
    IFeatureFlagService
} from "@binders/binders-service-common/lib/launchdarkly/server";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    ServerEvent,
    captureServerEvent
} from "@binders/binders-service-common/lib/tracking/capture";
import { UploadableFile, Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    buildPromptOptimizeBinderContent,
    buildPromptOptimizeChunkContent,
    sanitizeMarkdownResponse
} from "./internal/prompts";
import { AzureOpenAiLlmService } from "./internal/AzureOpenAiLlmService";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { Config } from "@binders/client/lib/config/config";
import { ContentServiceError } from "./internal/errors";
import { ContentServiceErrorCode } from "@binders/client/lib/clients/contentservice/v1/contract";
import { GeminiService } from "./internal/GeminiService";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { JSDOM } from "jsdom";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { ResourceNotFound } from "@binders/client/lib/clients/model";
import type { Response } from "express";
import { UnsupportedMedia } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { createReadStream } from "fs";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { getBlobConfig } from "@binders/binders-service-common/lib/storage/azure_object_storage";
import { isCollectionItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import multer from "multer";
import { unlink } from "fs-extra";

const LOG_TAG = "content-v1"

const upload = multer({ dest: "/tmp/llm-video-raw" })
const uploadSingleFile = upload.single("file");

async function uploadSingleFileAsync(
    request: WebRequest,
    response: Response,
): Promise<string> {
    const span = apm.startSpan("uploadSingleFileAsync", "file");
    return new Promise((resolve, reject) => {
        uploadSingleFile(request, response, (err) => {
            if (err) {
                span?.setOutcome("failure");
                reject(err)
            } else {
                span?.setOutcome("success");
                resolve(request.file.path)
            }
            span?.end();
        });
    });
}

export class ContentService implements ContentServiceContract {
    constructor(
        private readonly logger: Logger,
        private readonly llm: ILlmService,
        private readonly repository: BindersRepositoryServiceContract,
        private readonly accountService: AccountServiceContract,
        private readonly imageService: ImageServiceClient,
        private readonly llmVideo: ILlmVideoService,
        private readonly llmFileRepo: ILlmFileRepository,
        private readonly llmStorage: ILlmStorage,
        private readonly featureFlagService: IFeatureFlagService,
        private readonly trackingService: TrackingServiceContract,
    ) { }

    async fileUpload(
        accountId: string,
        _: UploadableFile[],
        request?: WebRequest,
        response?: Response,
    ): Promise<{ fileId: string }> {
        const identity = { accountId, userId: request.user?.userId };
        await this.#validateOneShotManualFeatures(accountId);
        const rawFilePath = await uploadSingleFileAsync(request, response);
        try {
            const mimeType = request.file?.mimetype || "";
            const filename = request.file?.originalname || "";
            if (!this.isVideoFile(mimeType, filename)) {
                this.logger.warn(`Rejected non-video file: ${filename} (${mimeType})`, LOG_TAG);
                throw new UnsupportedMedia();
            }
            const llmFile = await this.llmVideo.uploadFile(rawFilePath, this.logger);
            await this.llmStorage.addFile(rawFilePath, llmFile);
            const storedLlmFile = await this.llmFileRepo.save(llmFile);
            response.status(200)
                .setHeader("Content-Type", "application/json")
                .send(JSON.stringify(storedLlmFile));
            captureServerEvent(ServerEvent.ContentV1OneTakeManualFileUploaded, identity, {
                sizeBytes: llmFile.sizeBytes,
            });
            return storedLlmFile;
        } finally {
            await unlink(rawFilePath).catch((e) =>
                this.logger.warn(`Failed to cleanup temp file: ${rawFilePath}: ${e.message}`, LOG_TAG)
            );
        }
    }

    async forwardFileUpload(
        accountId: string,
        request: WebRequest,
        _requestHeaders?: Record<string, string>,
        response?: Response,
    ): Promise<{ fileId: string }> {
        return this.fileUpload(accountId, [], request, response);
    }

    async generateManual(req: GenerateManualRequest): Promise<Binder> {
        const { accountId, collectionId, context, fileIds, title, userId } = req;
        try {
            const startedAt = Date.now();
            await this.#validateOneShotManualFeatures(accountId);
            const llmFiles = await Promise.all(fileIds.map(fileId => this.llmFileRepo.getByFileId(fileId)));
            if (llmFiles.length !== 1) {
                throw new Error("File not found");
            }
            const llmFile = llmFiles.at(0);
            const { instructions, usage } = await this.llmVideo.generateManualFromVideo(llmFile, context, this.logger);
            captureServerEvent(
                ServerEvent.ContentV1OneTakeManualUsageIncreased,
                { accountId, userId },
                { usage, collectionId },
            );
            if ((instructions.steps?.length ?? 0) === 0) {
                throw new Error("Unrecognized content of the video.");
            }
            const binderObj = createBinder({
                accountId,
                languageCode: "en",
                title: title?.length ? title : instructions.title,
                chunkMarkdowns: instructions.steps.map(step => step.text),
            });
            const binder = BinderOperations.fromClassObject(binderObj).toApiObject();
            const savedBinder = await this.repository.createBinderBackend(binder);
            captureServerEvent(ServerEvent.DocumentCreated, { accountId, userId }, { itemId: savedBinder.id });
            this.#logItemEvent(EventType.ITEM_CREATED, binder, userId);
            await this.repository.addElementToCollection(collectionId, "document", savedBinder.id, accountId);
            const localFilePath = `/tmp/${llmFile.fileId.replaceAll("/", "-")}`;
            await this.llmStorage.getLocalCopy(llmFile.fileId, localFilePath);
            const visualIds = await this.imageService.uploadVisual(
                savedBinder.id,
                [createReadStream(localFilePath)],
                accountId,
            )
            const visualsMap = new Map<number, string[]>();
            const visuals = await this.imageService.listVisuals(savedBinder.id);
            const allVisuals: Visual[] = [];
            let chunkIdx = 0;
            for (const step of instructions.steps) {
                visualsMap.set(chunkIdx, visualIds);
                const visual = Object.assign(Object.create(BinderVisual.prototype), {
                    ...visuals.at(0),
                    startTimeMs: step.videoStartTimestampMs,
                    endTimeMs: step.videoEndTimestampMs,
                });
                allVisuals.push(visual);
                chunkIdx += 1;
            }
            const updatedBinder = BinderOperations
                .fromApiObject(savedBinder)
                .attachVisuals(visualsMap, allVisuals)
                .toApiObject();
            captureServerEvent(
                ServerEvent.ContentV1OneTakeManualTiming,
                { accountId, userId },
                { binderId: updatedBinder.id, durationMs: Date.now() - startedAt },
            );
            for (const visual of allVisuals) {
                const bv = visual as unknown as BinderVisual;
                if (bv.startTimeMs != null && Number.isFinite(bv.startTimeMs) && bv.startTimeMs >= 0) {
                    void this.imageService.ensureScreenshotAt(savedBinder.id, visual.id, bv.startTimeMs, accountId)
                        .catch(e => this.logger.error(`Failed to ensure screenshot at ${bv.startTimeMs} for visual ${visual.id}`, LOG_TAG, { error: e }));
                }
            }
            return this.repository.updateBinder(updatedBinder);
        } catch (e) {
            captureServerEvent(ServerEvent.ContentV1OneTakeManualFailed, { accountId, userId }, { collectionId, fileIds });
            throw e;
        }
    }

    /**
    * Optimizes content of the chunk
    * Optionally, updates the chunk in the Binder with the result
    */
    async optimizeChunkContent({
        accountId,
        binderId,
        chunkIdx,
        langIdx,
        save,
        userId,
    }: OptimizeChunkContentRequest & Identity): Promise<OptimizeChunkContentResponse> {
        await this.#validateContentOptimizationFeatures(accountId);
        const identity = { accountId, userId };

        const binder = await this.repository.getBinder(binderId);
        if (!binder) throw new ResourceNotFound(`Binder ${binderId} not found`);
        const ops = BinderOperations.fromApiObject(binder);

        const chunkMarkdown = ops.chunkToMarkdown(langIdx, chunkIdx);
        if (!chunkMarkdown.length) return {
            markdown: "",
            binder,
        };

        const optimizeChunkPrompt = buildPromptOptimizeChunkContent(chunkMarkdown);
        this.logger.trace(`optimizeChunkPrompt:\n'${optimizeChunkPrompt}'`, LOG_TAG);

        const rawChunkMarkdown = await this.llm.optimizeContent(optimizeChunkPrompt, {}, identity, { binderId });
        this.logger.trace(`rawChunkMarkdown:\n'${rawChunkMarkdown}'`, LOG_TAG);
        const sanitizedChunkMarkdown = sanitizeMarkdownResponse(rawChunkMarkdown.at(0));

        const binderWithChunk = (chunkIdx > 0 ?
            ops.replaceChunkWithMarkdown(langIdx, chunkIdx - 1, sanitizedChunkMarkdown) :
            ops.changeTitle(langIdx, sanitizedChunkMarkdown)).toApiObject();

        if (save) {
            this.logger.trace("saving the Binder", LOG_TAG);
            await this.repository.updateBinder(binderWithChunk);
        }

        return {
            markdown: sanitizedChunkMarkdown,
            binder: binderWithChunk,
        }
    }

    /**
    * Optimizes the content and formatting of the Binder.
    * Optionally, updates the Binder with the result
    */
    async optimizeBinderContent({
        accountId,
        binderId,
        langIdx,
        save,
        userId,
    }: OptimizeBinderContentRequest & Identity): Promise<OptimizeBinderContentResponse> {
        const identity = { accountId, userId };
        await this.#validateContentOptimizationFeatures(accountId);

        const binder = await this.repository.getBinder(binderId);
        if (!binder) throw new ResourceNotFound(`Binder ${binderId} not found`);
        const ops = BinderOperations.fromApiObject(binder);

        const binderXml = ops.toPseudoXml(langIdx);
        if (!binderXml.length) return {
            binder,
        };

        const optimizeBinderPrompt = buildPromptOptimizeBinderContent(binderXml);
        this.logger.trace(`optimizeBinderPrompt (${optimizeBinderPrompt.length}):\n'${optimizeBinderPrompt}'`, LOG_TAG);

        const stats = {
            binderId,
            langIdx,
            chunksCount: binder.binderLog.current.length,
            binderTextLength: binderXml.length,
            promptTextLength: optimizeBinderPrompt.length,
        }

        const bindersChoices = await this.#llmOptimizeBinder({ binder, choicesCount: 1, optimizeBinderPrompt }, identity);

        let binderChoice: string[] = []
        if (bindersChoices.length) {
            binderChoice = bindersChoices.at(0);
        } else {
            captureServerEvent(ServerEvent.ContentV1OptimizeBinderFirstFail, identity, stats);
            this.logger.trace("No valid choices, retrying with 3 alternatives", LOG_TAG)
            const nextChunksChoices = await this.#llmOptimizeBinder({
                binder,
                choicesCount: 3,
                optimizeBinderPrompt,
                logNoChoicesError: true,
            }, identity);
            binderChoice = nextChunksChoices.length ? nextChunksChoices.at(0) : []
        }

        if (!binderChoice.length) {
            captureServerEvent(ServerEvent.ContentV1OptimizeBinderAllFailed, identity, stats);
            throw new ContentServiceError(
                ContentServiceErrorCode.NoChoices,
                "Failed to get optimized chunks",
            )
        }

        const updatedBinder = ops.replaceAllChunks(langIdx, binderChoice).toApiObject();

        if (save) {
            this.logger.trace("saving the Binder", LOG_TAG);
            await this.repository.updateBinder(updatedBinder);
        }

        const optimizedBinderXml = BinderOperations.fromApiObject(updatedBinder).toPseudoXml(langIdx);
        captureServerEvent(ServerEvent.ContentV1OptimizeBinderDone, identity, {
            ...stats,
            optimizedBinderTextLength: optimizedBinderXml?.length ?? 0,
            optimizedChoicesCount: bindersChoices.length,
        });

        return {
            binder: updatedBinder,
        }
    }

    async updateVisualTrimSettings(
        _accountId: string,
        binderId: string,
        visualIdx: number,
        chunkIdx: number,
        startTimeMs: number,
        endTimeMs: number,
    ): Promise<Binder> {
        const binder = await this.repository.getBinder(binderId);
        const binderObj = BinderOperations
            .fromApiObject(binder)
            .toClassObject();
        const visual = {
            ...binderObj.getImagesModule(binderObj.getImagesModuleKey())
                .chunks.at(chunkIdx - 1).at(visualIdx),
            startTimeMs,
            endTimeMs,
        }
        this.imageService.ensureScreenshotAt(binderId, visual.id, startTimeMs, _accountId);
        const updatedBinder = BinderOperations
            .fromApiObject(binder)
            .updateVisualData(chunkIdx - 1, visualIdx, visual)
            .toApiObject();
        return this.repository.updateBinder(updatedBinder);
    }

    async #llmOptimizeBinder(options: {
        binder: Binder;
        optimizeBinderPrompt: string;
        choicesCount: number;
        logNoChoicesError?: boolean;
    }, identity: Identity): Promise<string[][]> {
        const rawChunksChoices = await this.llm.optimizeContent(
            options.optimizeBinderPrompt,
            { choicesCount: options.choicesCount ?? 1, logNoChoicesError: options.logNoChoicesError },
            identity,
            { binderId: options.binder.id },
        );
        const chunksChoices = rawChunksChoices
            .map(c => c.replace(/^\s*```|```\s*$/g, "").trim())
            .map(parseChunksXml)
        const validChunksChoices = chunksChoices
            .filter(chunks => options.binder.binderLog?.current.length === chunks.length);

        if (!validChunksChoices.length && chunksChoices.length) {
            this.logger.error(
                "optimizeBinderContent",
                LOG_TAG,
                { rawChunksChoices, validChunksChoices },
            );
        }

        this.logger.trace(
            "optimizeBinderContent",
            LOG_TAG,
            {
                binderChunksCount: options.binder.binderLog?.current.length,
                optimizedChunksCounts: chunksChoices.map(c => c.length),
                chunksChoices: chunksChoices.length,
                validChunksChoices: validChunksChoices.length,
            }
        );
        return validChunksChoices;
    }

    async #validateContentOptimizationFeatures(accountId: string): Promise<void> {
        const accountFeatures = await this.accountService.getAccountFeatures(accountId);
        if (!accountFeatures.includes(FEATURE_AI_CONTENT_FORMATTING)) {
            throw new Error("The feature is not activated for the account.");
        }
    }

    async #validateOneShotManualFeatures(accountId: string): Promise<void> {
        const flagSet = await this.featureFlagService.getFlag<boolean>(LDFlags.MANUAL_FROM_VIDEO, { accountId });
        if (!flagSet) {
            throw new Error("The feature is not activated for the account.");
        }
    }

    #logItemEvent(type: EventType, item: Binder | DocumentCollection, userId: string): void {
        this.#logEventAsync({
            eventType: type,
            accountId: item.accountId,
            data: {
                itemId: item.id,
                itemKind: isCollectionItem(item) ? ItemKind.Collection : ItemKind.Binder,
                itemTitle: isCollectionItem(item) ? extractTitle(item) : undefined
            },
            userId: userId,
        }, userId);
    }

    #logEventAsync(event: EventPayload, userId: string): void {
        (async () => {
            try {
                await this.trackingService.log([event], userId);
            } catch (error) {
                this.logger.error("Failed to async log event", "log-event", { event, error });
            }
        })();
    }

    private geminiSupportedVideoExtensions = ["mp4", "mpeg", "mov", "avi", "flv", "mpg", "webm", "wmv", "3gp"]; // list from https://ai.google.dev/gemini-api/docs/video-understanding
    private isVideoFile(mimeType: string, filename: string): boolean {
        if (mimeType && mimeType.startsWith("video/")) {
            return true;
        }
        // Fallback to extension-based detection
        const ext = filename.split(".").pop()?.toLowerCase();
        return this.geminiSupportedVideoExtensions.includes(ext || "");
    }
}

function parseChunksXml(xml: string): string[] {
    try {
        const dom = new JSDOM(xml, { contentType: "text/html" });
        const document = dom.window.document;
        const chunks = document.querySelectorAll("chunk");
        return [...chunks.values()].map(c => c.innerHTML);
    } catch (e) {
        return []
    }
}

export class ContentServiceFactory {
    constructor(
        private logger: Logger,
        private llm: ILlmService,
        private repository: BindersRepositoryServiceContract,
        private accountService: AccountServiceContract,
        private imageService: ImageServiceClient,
        private llmVideoService: ILlmVideoService,
        private llmFileRepo: ILlmFileRepository,
        private llmStorage: ILlmStorage,
        private featureFlagService: IFeatureFlagService,
        private trackingService: TrackingServiceContract,
    ) { }

    static async fromConfig(config: Config): Promise<ContentServiceFactory> {
        return ContentServiceFactory.fromDependencies({}, config)
    }

    /**
     * Build ContentService from explicit dependencies
     * The dependencies not provided in the argument will be built from the config
     */
    static async fromDependencies(
        deps: Partial<{
            logger: Logger;
            llm: ILlmService;
            repository: BindersRepositoryServiceContract;
            accountService: AccountServiceContract;
            imageService: ImageServiceClient;
            llmVideoService: ILlmVideoService,
            llmFileRepo: ILlmFileRepository,
            llmStorage: ILlmStorage,
            featureFlagService: IFeatureFlagService,
            trackingService: TrackingServiceContract,
        }>,
        config?: Config,
    ): Promise<ContentServiceFactory> {
        const loginOption = getMongoLogin("repository_service");
        const llmFileRepoConfig = await CollectionConfig.promiseFromConfig(config, "llmFiles", loginOption);
        const logger = deps.logger ?? LoggerBuilder.fromConfig(config);
        const llmStorageConfig = getBlobConfig(config, "llm", logger);
        logger.trace(`Creating ContentService from dependencies ${JSON.stringify(Object.keys(deps))}`, LOG_TAG);
        return new ContentServiceFactory(
            logger,
            deps.llm ?? AzureOpenAiLlmService.fromConfig(config),
            deps.repository ?? await BackendRepoServiceClient.fromConfig(config, "gen-service"),
            deps.accountService ?? await BackendAccountServiceClient.fromConfig(config, "gen-service"),
            deps.imageService ?? await BackendImageServiceClient.fromConfig(config, "gen-service"),
            deps.llmVideoService ?? GeminiService.fromConfig(config),
            deps.llmFileRepo ?? new LlmFileRepositoryFactory(llmFileRepoConfig, logger).build(logger),
            deps.llmStorage ?? new LlmAzureStorage(logger, llmStorageConfig),
            deps.featureFlagService ?? await LaunchDarklyService.create(config, logger),
            deps.trackingService ?? await BackendTrackingServiceClient.fromConfig(config, "gen-service"),
        )
    }

    public build(): ContentServiceContract {
        return new ContentService(
            this.logger,
            this.llm,
            this.repository,
            this.accountService,
            this.imageService,
            this.llmVideoService,
            this.llmFileRepo,
            this.llmStorage,
            this.featureFlagService,
            this.trackingService,
        );
    }

    public forRequest(request: WebRequest): ContentService {
        return new ContentService(
            request.logger,
            this.llm,
            this.repository,
            this.accountService,
            this.imageService,
            this.llmVideoService,
            this.llmFileRepo,
            this.llmStorage,
            this.featureFlagService,
            this.trackingService,
        );
    }
}

