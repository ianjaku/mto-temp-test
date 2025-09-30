import * as HTTPStatusCode from "http-status-codes";
import * as express from "express";
import * as path from "path";
import * as superagent from "superagent";
import {
    AccountServiceContract,
    IVisualsAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    WebRequest as BaseWebRequest,
    finishRequestTimings
} from "@binders/binders-service-common/lib/middleware/request";
import {
    Format as ClientFormat,
    Image as ClientImage,
    VideoFormat as ClientVideoFormat,
    Visual as ClientVisual,
    DuplicatedVisual,
    IVideoIndexerResult,
    IVideoIndexerResultFilter,
    IVisualFormatSpec,
    IVisualFormatUrlMap,
    IVisualSearchOptions,
    ImageFitBehaviour,
    ImageFormatType,
    ImageRotation,
    ImageServiceContract,
    ImageServiceContractBuilder,
    MAX_ATTACHMENTS_PER_COMMENT,
    MAX_VISUALS_PER_UPLOAD_REQ,
    ProcessingStep,
    UploadVisualOptions,
    UploadableFile,
    VideoDuration,
    VideoFormatType,
    VisualFormatType,
    VisualKind,
    VisualProcessingJob,
    VisualStatus,
    VisualUsage,
    isVideoFormat
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { IVideoIndexerRepository, IVideoIndexerRepositoryFactory } from "./videoIndexerRepository";
import {
    Image,
    ImageFormat,
    ImageIdentifier,
    LogoIdentifier,
    StreamingInfo,
    SupportedAudioCodec,
    SupportedVideoCodec,
    Video,
    VideoFormat,
    VideoIdentifier,
    Visual,
    VisualFormat,
    VisualIdentifier,
    isScreenshotFormat,
    isVideo,
    isVideoFormat as isVideoFormatModel,
    isVideoIdString,
    stringToVisualFormatType,
    visualFormatTypeToString
} from "./model";
import {
    MAX_VIDEO_PROCESSING_RETRIES,
    MaxReprocessingRetriesError,
    ProcessingJobInProgressError,
    VisualProcessingJobsRepository,
    VisualProcessingJobsRepositoryFactory
} from "./repositories/visualProcessingJobsRepository";
import { MediaStorage, VisualStorageDetails } from "../storage/contract";
import { NextFunction, Response } from "express";
import {
    NotificationServiceContract,
    RoutingKeyType,
    ServiceNotificationType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    UnsupportedMedia,
    UnsupportedMime,
    canVideoFormatBeDisplayedInBrowser,
    extractIdFromUrl,
    isUnsupportedMediaTypeError
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import { VisualCreationAttributes, VisualRepository, VisualUpdate } from "./repositories/contract";
import { addTokenToUrl, rewriteManifest } from "./hlsProxy";
import { buildImageAzureURL, buildVideoAzureURL } from "../storage/azure/AzureURLBuilder";
import {
    extractContainerFromAzureStorageLocation,
    extractImageIdFromAzureStorageLocation,
    extractItemIdFromAzureStorageLocation
} from "../storage/azure/helpers";
import { get as httpGet, get as httpsGet } from "https";
import {
    ACCOUNT_SERVICE_CACHE_OPTIONS
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { AzureItemStorage } from "../storage/azure/azureItemStorage";
import { BinderVisualRepositoryFactory } from "./repositories/binderVisualRepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { BindersServiceClientConfig } from "@binders/client/lib/clients/config";
import { BitmovinHandler } from "../visualhandlers/bitmovin/BitmovinHandler";
import Busboy from "busboy";
import {
    CredentialServiceContract
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import { EntityNotFound } from "@binders/client/lib/clients/model";
import { FontStorage } from "../storage/fonts";
import {
    IExpressResponseOptions
} from "@binders/binders-service-common/lib/storage/object_storage";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import { LegacyVideoStorage } from "../storage/legacyVideoStorage";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Logo } from "@binders/client/lib/clients/routingservice/v1/contract";
import { Maybe } from "@binders/client/lib/monad";
import { MultiStorage } from "../storage/multi";
import { Readable } from "stream";
import { RedisCacheBuilder } from "@binders/binders-service-common/lib/cache/redis";
import { RedisClient } from "@binders/binders-service-common/lib/redis/client";
import { ScreenshotHandler } from "../processing/ScreenshotHandler";
import { TRIMMING_MATCH_TOLERANCE_SEC } from "@binders/client/lib/clients/imageservice/v1/Visual";
import TokenAcl from "@binders/client/lib/clients/authorizationservice/v1/tokenacl";
import { TranslationKeys } from "@binders/client/lib/i18n/translations";
import { URLBuilder } from "./urls";
import UUID from "@binders/client/lib/util/uuid";
import { VideoProcessor } from "./video/VideoProcessor";
import { VideoStorage } from "../storage/videoStorage";
import { VisualHandlers } from "./visualhandlers";
import { buildOriginalVideoAzureURL } from "../storage/azure/AzureURLBuilder";
import { convertImageToDifferentFormat } from "../visualhandlers/heic-webp";
import { convertTiffToJpg } from "../visualhandlers/sharp";
import { createWriteStream } from "fs";
import { detectMimeFromBuffer } from "../helper/mime";
import { differenceInSeconds } from "date-fns";
import fetch from "node-fetch";
import { getContainerNameFromUri } from "@binders/client/lib/util/azureStorage";
import {
    incrementVideoProcessingRestartsCounterByOne
} from "@binders/binders-service-common/lib/monitoring/prometheus/videoProcessingRestart";
import { isSafeForRedirect } from "@binders/binders-service-common/lib/util/url";
import { isStreamWritable } from "@binders/binders-service-common/lib/util/stream";
import { maybeStripAPAC } from "../visualhandlers/bitmovin/preprocess";
import { resizeImage } from "../processing/resizeImage";
import { safeDeleteFile } from "../helper/filesystem";
import { splitEvery } from "ramda";
import { tmpdir } from "os";
import { trimSlashes } from "@binders/client/lib/util/uri";

export interface ImageServiceRequestProps {
    imageStorage: MultiStorage;
    logoStorage: AzureItemStorage;
    fontStorage: FontStorage;
}
export interface WebRequest extends BaseWebRequest, ImageServiceRequestProps {

}

const takeFileNameFromPath = (fullPath: string) => {
    return path.parse(fullPath).name;
};

const RANGE_HEADER_PATTERN = /bytes=([0-9]*)-([0-9]*)/;


type BusboyInfo = {
    encoding: string;
    filename: string;
    mimeType: string;
}

export class ProcessingJobRestartError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ProcessingJobRestartError.prototype);  // ES5 >= requirement
    }
}

export class ImageService implements ImageServiceContract {

    constructor(
        private logger: Logger,
        private binderVisualRepository: VisualRepository,
        private videoIndexerRepository: IVideoIndexerRepository,
        private readonly visualProcessingJobsRepository: VisualProcessingJobsRepository,
        private imageStorage: MultiStorage,
        private logoStorage: AzureItemStorage,
        private urlBuilder: URLBuilder,
        private readonly bindersConfig: BindersConfig,
        private readonly imageServiceBaseUri: string,
        private readonly credentialServiceClient: CredentialServiceContract,
        private readonly notificationServiceClient: NotificationServiceContract,
        private accountServiceClient: AccountServiceContract,
        private cachingAccountServiceClient: AccountServiceContract
    ) {
        if (process.env.LOCAL_IMAEGSERVICE_TUNNEL) {
            this.imageServiceBaseUri = process.env.LOCAL_IMAEGSERVICE_TUNNEL;
        }
    }

    async createVideoSasTokens(videoIds: string[]): Promise<Record<string, string>> {
        const bitmovinHandler = new BitmovinHandler(this.bindersConfig, this.logger);
        const tokens: Record<string, string> = {};

        const videos = await this.binderVisualRepository.findVisuals({ ids: videoIds });
        for (const video of videos) {
            const manifestUri = video.streamingInfo?.manifestPaths.at(0);
            const containerName = manifestUri ? getContainerNameFromUri(manifestUri) : video.id.value();
            tokens[containerName] = bitmovinHandler.createAccessToken(containerName);
        }
        return tokens;
    }

    async queryVideoDurations(videoIds: string[]): Promise<VideoDuration> {
        const videos = await this.binderVisualRepository.findVisuals({ ids: videoIds });
        const skippedVisualIds = [];
        const durations = videos.reduce((out, video) => {
            const durationInMs = (video.formats[0] as VideoFormat).durationInMs;
            if (!durationInMs) {
                skippedVisualIds.push(video.id);
            }
            out[video.id.value()] = durationInMs;
            return out;
        }, {} as { [id: string]: number });
        return {
            durations,
            skippedVisualIds,
        }
    }

    async getVisualByOriginalVisualData(originalBinderId: string, originalImageId: string, newBinderId: string): Promise<ClientVisual> {
        const image = await this.binderVisualRepository.getImageIdByOriginalVisualData(originalBinderId, originalImageId, newBinderId);
        return this.toClientVisual(image, true);
    }

    /**
     * Attempts to find the visual id for the given visual url.
     *
     * @param url
     * @returns the visual id on success, and null on failure
     */
    async getVisualIdByImageUrl(url: string): Promise<string> {
        const idMatch = url.match(/img-[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}/i);
        if (idMatch != null) {
            return idMatch[0];
        }
        const videoIdMatch = url.match(/vid-[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}/i);
        if (videoIdMatch != null) {
            return videoIdMatch[0];
        }
        return null;
    }

    private async buildVideoUrl(visual: ClientVisual, format: ClientFormat, cdnnify: boolean): Promise<string> {
        if (visual.scheme.startsWith("s3:")) {
            return format.url;
        }
        if (cdnnify) {
            return buildVideoAzureURL(this.bindersConfig, format.container, format.blobName);
        }
        const isFormatVideo = !!(format as ClientVideoFormat).videoCodec;
        if (isFormatVideo) {
            return `${this.imageServiceBaseUri}/binders/${visual.binderId}/${visual.id}/${format.name}`;
        }
        return format.url;
    }

    async buildImageUrl(visual: ClientVisual, format: ClientFormat, cdnnify: boolean): Promise<string> {
        if (cdnnify) {
            return buildImageAzureURL(
                this.bindersConfig,
                format.itemIdFromStorageLocation,
                format.visualIdFromStorageLocation || visual.id,
                format.name);
        }
        return format.url;
    }

    private async buildVisualUrl(visual: ClientVisual, format: ClientFormat, cdnnify: boolean): Promise<string> {
        const isVideo = isVideoIdString(visual.id);
        return isVideo ?
            this.buildVideoUrl(visual, format, cdnnify) :
            this.buildImageUrl(visual, format, cdnnify);
    }

    async getBinderIdsForVisualIds(visualIds: string[]): Promise<string[]> {
        const binderIds = await this.binderVisualRepository.getBinderIdsForVisualIds(visualIds);
        return Array.from(new Set(binderIds))
    }

    async ensureScreenshotAt(
        binderId: string, 
        visualId: string,
        timestampMs: number,
        accountId: string,
    ): Promise<void> {
        const idObj = VisualIdentifier.parse(visualId);
        const visual = await this.binderVisualRepository.getVisual(binderId, idObj) as Video;
        if (!(visual.id instanceof VideoIdentifier)) {
            throw new InvalidArgument("ensureScreenshotAt only works for videos");
        }
        await this.ensureSingleScreenshotAtTime(visual, timestampMs, accountId);
    }
    
    private async ensureSingleScreenshotAtTime(
        video: Video,
        timestampMs: number,
        accountId: string,
    ): Promise<void> {
        const isFrameAtSimilarTime = (f: VisualFormat) => Math.abs(f["keyFramePosition"] - (timestampMs / 1000)) <= TRIMMING_MATCH_TOLERANCE_SEC;
        const formats = video.formats as VisualFormat[];
        const existingAtTime = formats
            .filter(f => isScreenshotFormat(f.format) && f["keyFramePosition"] != null)
            .some(isFrameAtSimilarTime);
        if (existingAtTime) {
            return;
        }
        const screenshotHandler = new ScreenshotHandler(this.bindersConfig, this.logger, this.imageStorage);
        const videoUrl = await buildOriginalVideoAzureURL(video, this.bindersConfig);
        const newFormats = await screenshotHandler.takeScreenshotAt(video, videoUrl, timestampMs / 1000);
        const enriched = newFormats.map(f => ({ ...f, keyFramePosition: (timestampMs / 1000) }));
        const extraFormats = await Promise.all(
            enriched.map(format => this.fromClientFormat(video.binderId, video.id, format))
        );
        await this.binderVisualRepository.updateVisual(
            video.binderId,
            video.id,
            { extraFormats }
        );
        this.notificationServiceClient.dispatch(
            { type: RoutingKeyType.ACCOUNT, value: accountId },
            ServiceNotificationType.VIDEOPROCESSING_END,
            {
                visualId: video.id.value(),
                binderId: video.binderId,
                accountId
            }
        );
    }

    private async composeFormatUrls(visuals: Visual[], options: IVisualSearchOptions): Promise<IVisualFormatUrlMap> {
        const bitmovinHandler = new BitmovinHandler(this.bindersConfig, this.logger);
        const resp: IVisualFormatUrlMap = {};
        for (const visual of visuals) {
            const clientVisual = this.toClientVisual(visual, false);
            const contentKeyId = visual.streamingInfo?.contentKeyId;

            const original = (visual.formats as VisualFormat[]).find(format => format.format === VideoFormatType.ORIGINAL);
            let sasToken: string;
            let manifestUrls = clientVisual.manifestUrls;
            if (VideoStorage.matchesStorageScheme(original?.storageLocation)) {
                const manifestUri = visual.streamingInfo?.manifestPaths.at(0);
                const containerName = manifestUri ? getContainerNameFromUri(manifestUri) : visual.id.value();
                sasToken = bitmovinHandler.createAccessToken(containerName);
                if (manifestUrls != null) {
                    manifestUrls = manifestUrls.map(url => url + "?" + sasToken);
                }
            }

            resp[clientVisual.id] = {
                formats: await this.getFormatSpecs(clientVisual, options.cdnnify),
                manifestUrls,
                contentKeyId,
                sasToken,
            };
        }
        return resp;
    }

    private async getFormatSpecs(visual: ClientVisual, cdnnify = true): Promise<IVisualFormatSpec[]> {
        // MT-2702: Format is not properly displayed on iOS 9 or lower
        const nonIphoneVideoFormats = visual.formats.filter(format => !format.name.startsWith("VIDEO_IPHONE"));
        const formatSpecs = [];
        for (const format of nonIphoneVideoFormats) {
            const videoCodec = format["videoCodec"];
            const browserSupported = !videoCodec ?
                {} :
                {
                    browserSupportsVideoCodec: canVideoFormatBeDisplayedInBrowser(format.name, visual.mime, videoCodec)
                };
            formatSpecs.push({
                width: format.width,
                height: format.height,
                url: await this.buildVisualUrl(visual, format, cdnnify),
                name: format.name,
                scheme: visual.scheme,
                isVideo: !!videoCodec, // isVideo here refers to this specific format (can be an image (thumbnail) while visual is a video),
                keyFramePosition: format.keyFramePosition,
                ...browserSupported,
            });
        }
        return formatSpecs;
    }

    async composeVisualFormatUrls(visualIds: string[], options: IVisualSearchOptions): Promise<IVisualFormatUrlMap> {
        const visuals = await this.binderVisualRepository.findVisuals({
            ids: visualIds
        });
        return this.composeFormatUrls(visuals, options);
    }

    async videoIndexerCallback(_id: string, _state: string): Promise<void> {
        // video indexing is currently not functional and will be reimplemented in MT-4890, check git history for original code
    }

    async findVideoIndexerResults(filter: IVideoIndexerResultFilter): Promise<IVideoIndexerResult[]> {
        return this.videoIndexerRepository.findVideoIndexerResults(filter);
    }

    private async onVideoIndexerResultUpdate(
        videoIndexerResult: IVideoIndexerResult,
    ) {
        await this.videoIndexerRepository.saveVideoIndexerResult(videoIndexerResult);
        this.notificationServiceClient.dispatch(
            {
                type: RoutingKeyType.ACCOUNT,
                value: videoIndexerResult.accountId,
            },
            ServiceNotificationType.VIDEOINDEXING_PROGRESS,
            videoIndexerResult,
        )
    }

    async indexVideo(_visualId: string, _accountId: string): Promise<void> {
        // video indexing is currently not functional and will be reimplemented in MT-4890, check git history for original code
    }

    async addLogo(accountId: string, _attachments: unknown, request: WebRequest, response: Response, _next: NextFunction): Promise<Logo> {
        const logger = this.logger;
        const busboy = Busboy({ headers: request.headers, defParamCharset: "utf8" });
        let filePromise: Promise<Logo>;
        busboy.on("file", (fieldname, stream, fullPath, encoding, mimeFromBusboy) => {
            filePromise = new Promise<Logo>((resolve) => {

                let mime;
                const onFirstChunkRead = async (firstChunk: Buffer) => {
                    const mimeFromBuffer = await detectMimeFromBuffer(firstChunk);
                    mime = normalizeMimeType(mimeFromBuffer || mimeFromBusboy, fullPath);
                };

                const onClose = async (tmpPath) => {
                    const logData = {
                        fileName: fullPath,
                        fieldName: fieldname,
                        encoding: encoding,
                        mimeType: mime
                    };
                    this.logIncomingFileUpload(logger, logData);
                    if (isStreamWritable(response, logger, "image-upload")) {
                        const logoId = LogoIdentifier.generate();
                        const fileName = `${accountId}/${logoId.value()}`;
                        await this.logoStorage.addItem(fileName, tmpPath);
                        const logo = await this.getLogo(logoId, accountId);
                        resolve(logo);
                    }
                };

                const uniqueName = `logo_${accountId}_${UUID.random().toString()}_${fullPath}`;
                this.writeFile(stream, uniqueName, onFirstChunkRead, onClose);
            });
        });
        busboy.on("finish", () => {
            filePromise
                .then(logo => this.finishUploadWithSuccess(request, response, logo))
                .catch(error => this.finishUploadWithErrors(request, response, [error]));
        });

        request.pipe(busboy);
        return Promise.resolve(undefined);
    }

    private async getLogo(logoId: LogoIdentifier, accountId: string): Promise<Logo> {
        const url = `${this.imageServiceBaseUri}/logos/${accountId}/${logoId.value()}`;
        return {
            url,
            mime: "image/svg+xml",
            size: 1024
        };
    }

    async listVisuals(binderId: string, options: IVisualSearchOptions = {}): Promise<Array<ClientVisual>> {
        const urlToken = await this.credentialServiceClient.createUrlToken(TokenAcl.fromItemIds([binderId]), 1);
        const visuals = await this.binderVisualRepository.listBinderVisuals(
            binderId,
            VisualUsage.BinderChunk,
            { ignoreStatus: options.ignoreStatus }
        );
        const visualFormatUrlMap = await this.composeFormatUrls(visuals, { urlToken, cdnnify: options.cdnnify });
        return visuals.map((visual) => {
            const clientVisual = this.toClientVisual(visual, false);
            return {
                ...clientVisual,
                formatUrls: visualFormatUrlMap[clientVisual.id].formats,
                manifestUrls: visualFormatUrlMap[clientVisual.id].manifestUrls,
                urlToken,
            };
        });
    }

    async getFeedbackAttachmentVisuals(binderId: string, options: IVisualSearchOptions = {}): Promise<Array<ClientVisual>> {
        const urlToken = await this.credentialServiceClient.createUrlToken(TokenAcl.fromItemIds([binderId]), 1);
        const attachmentVisuals = await this.binderVisualRepository.listBinderVisuals(
            binderId,
            VisualUsage.ReaderComment
        ) as Visual[];
        const visualFormatUrlMap = await this.composeFormatUrls(attachmentVisuals, { urlToken, cdnnify: options.cdnnify });
        return attachmentVisuals.map((feedbackAttachment) => {
            const clientFeedbackAttachment = this.toClientVisual(feedbackAttachment, false);
            return {
                ...clientFeedbackAttachment,
                formatUrls: visualFormatUrlMap[clientFeedbackAttachment.id].formats,
                urlToken,
            };
        });
    }

    async loadVisual(binderId: string, visualId: string): Promise<Visual> {
        const visualIdObject = VisualIdentifier.parse(visualId);
        return this.binderVisualRepository.getVisual(binderId, visualIdObject);
    }

    async getVisual(binderId: string, visualId: string, options: IVisualSearchOptions = {}): Promise<ClientVisual> {
        const visual = await this.loadVisual(binderId, visualId);
        const urlToken = await this.credentialServiceClient.createUrlToken(TokenAcl.fromItemIds([binderId]), 1);
        const visualFormatUrlMap = await this.composeFormatUrls([visual], { urlToken, cdnnify: options.cdnnify });
        const clientVisual = this.toClientVisual(visual, true);
        return {
            ...clientVisual,
            formatUrls: visualFormatUrlMap[clientVisual.id].formats,
            manifestUrls: visualFormatUrlMap[clientVisual.id].manifestUrls,
            urlToken,
        }
    }

    async duplicateVisuals(binderId: string, targetId: string): Promise<Array<DuplicatedVisual>> {
        const visuals = await this.listVisuals(binderId, { ignoreStatus: true });
        this.logger.trace(`Duplicating ${visuals.length} visuals`, "duplicate visuals");
        return visuals.reduce(async (reduced, visual) => {
            const duplicatedVisuals = await reduced;
            const newDuplicate = await this.duplicateVisual(binderId, targetId, visual);
            return [...duplicatedVisuals, newDuplicate];
        }, Promise.resolve([]));
    }

    private async duplicateVisual(
        binderId: string,
        targetId: string,
        clientVisual: ClientVisual
    ): Promise<DuplicatedVisual> {
        this.logger.trace(`Duplicating visual ${binderId} / ${clientVisual.id}`, "visual-dup");
        const visualId = VisualIdentifier.parse(clientVisual.id);
        const visual = await this.binderVisualRepository.getVisual(binderId, visualId);
        const { formats, mime } = visual;
        const newVisualId = VisualIdentifier.generate(mime);
        this.logger.trace(`will save visual with id: ${newVisualId.value()}`, "visual-dup");

        const newVisual: Visual = {
            ...visual,
            id: newVisualId as ImageIdentifier,
            originalVisualData: visual.originalVisualData ? visual.originalVisualData : { originalId: visualId.value(), binderId: binderId },
            binderId: targetId,
            created: new Date(),
        };
        const resultVisual = await this.binderVisualRepository.saveVisual(newVisual);
        this.logger.trace("Saved updated visual", "visual-dup");
        const urlMap: { [oldUrl: string]: string } = {};
        const toUrlMap = (format: VisualFormat): void => {
            const originalUrl = this.getVisualUrl(binderId, visualId, format);
            const updatedUrl = this.getVisualUrl(targetId, newVisualId, format);
            urlMap[originalUrl] = updatedUrl;
        };
        (formats as VisualFormat[]).forEach(format => toUrlMap(format));
        return { ...this.toClientVisual(resultVisual), urlMap };
    }

    private async readHttpFileAsync(url: string, filename: string): Promise<string> {
        const writeStream = createWriteStream(filename);
        const getFn = url.indexOf("https") === 0 ? httpsGet : httpGet;
        return new Promise<string>((resolve, reject) => {
            getFn(url, response => {
                const { statusCode } = response;
                if (statusCode !== 200) {
                    const msg = `Request to ${url} failed with status code: ${statusCode}`;
                    return reject(new Error(msg));
                }
                response.pipe(writeStream);
                writeStream.on("close", () => resolve(response.headers["content-type"]));
            });
        });
    }

    private onBusboyFile(
        visualProcessingPromises: Promise<string>[],
        namePrefix: string,
        response: Response,
        callbackFn: (tmpPath: string, fullPath: string, mimeType: string) => Promise<string>,
    ): (fieldname: string, file: Readable, info: BusboyInfo) => void {
        return (fieldname, stream, info): void => {
            const { filename: fullPath, encoding, mimeType: mimeFromBusboy } = info;
            const visualProcessingPromise = new Promise<string>((resolve, reject) => {
                const uniqueName = `${namePrefix}_${UUID.random().toString()}_${fullPath}`;
                let mime: string;

                const onFirstChunkRead = async (firstChunk: Buffer) => {
                    const mimeFromBuffer = await detectMimeFromBuffer(firstChunk);
                    mime = normalizeMimeType(mimeFromBuffer || mimeFromBusboy, fullPath);
                    if (!this.checkIfVisualIsSupported(mime)) {
                        stream.resume(); // marks the file stream as consumed, otherwise the busyboy file callback doesn't resolve
                        reject(new UnsupportedMime(mime));
                    }
                };

                const onClose = async (tmpPath: string) => {
                    this.logIncomingFileUpload(this.logger, { fileName: fullPath, fieldname, encoding, mime });
                    if (!isStreamWritable(response, this.logger, "visual-upload")) {
                        resolve(undefined);
                    }
                    try {
                        await this.checkIfCodecsAreSupported(this.logger, tmpPath, mime);
                        return callbackFn(tmpPath, fullPath, mime).then(resolve, reject);
                    } catch (e) {
                        reject(e);
                    }
                };
                this.writeFile(stream, uniqueName, onFirstChunkRead, onClose);
            });
            visualProcessingPromises.push(visualProcessingPromise);
        };
    }

    private async onBusboyFinish(
        request: WebRequest,
        response: Response,
        visualProcessingPromises: Promise<string>[],
    ): Promise<void> {
        const visualIds = new Set<string>();
        const errors: Error[] = [];
        const results = await Promise.allSettled(visualProcessingPromises);
        for (const result of results) {
            if (result.status === "rejected") {
                errors.push(result.reason);
            } else {
                visualIds.add(result.value);
            }
        }
        return errors.length > 0 ?
            this.finishUploadWithErrors(request, response, errors) :
            this.finishUploadWithSuccess(request, response, [...visualIds]);
    }

    async uploadVisual(
        binderId: string,
        _attachments: UploadableFile[],
        accountId: string,
        request: WebRequest,
        response: Response,
        _next: NextFunction,
        options: UploadVisualOptions | null,
    ): Promise<string[]> {
        const maxNumberOfFiles = options?.visualUsage === VisualUsage.ReaderComment ?
            MAX_ATTACHMENTS_PER_COMMENT :
            MAX_VISUALS_PER_UPLOAD_REQ;
        const busboy = Busboy({
            headers: request.headers,
            defParamCharset: "utf8",
            limits: { files: maxNumberOfFiles }
        });

        const accountSettings = await this.cachingAccountServiceClient.getAccountSettings(accountId);
        await this.accountServiceClient.updateStorageDetails(accountId, { dirty: true })
        const visualProcessingPromises: Promise<string>[] = [];
        const callback = async (tmpPath: string, fullPath: string, mimeType: string) => {
            try {
                return await this.addVisualFile(binderId, tmpPath, fullPath, mimeType, accountId, accountSettings.visuals, options);
            } finally {
                await safeDeleteFile(tmpPath, this.logger);
            }
        };
        busboy.on(
            "file",
            this.onBusboyFile(visualProcessingPromises, binderId, response, callback),
        );
        busboy.on(
            "filesLimit",
            () => this.onBusboyFilesLimit(request, response, visualProcessingPromises),
        );
        busboy.on(
            "finish",
            () => this.onBusboyFinish(request, response, visualProcessingPromises),
        );

        request.pipe(busboy);
        return Promise.resolve(undefined);
    }

    private async onBusboyFilesLimit(
        request: WebRequest,
        response: Response,
        visualProcessingPromises: Promise<unknown>[],
    ): Promise<void> {
        await Promise.allSettled(visualProcessingPromises);
        this.endWithBadRequest(request, response, new Error("Too many visuals"));
    }

    private logIncomingFileUpload(logger: Logger, data: unknown) {
        logger.debug("Incoming file", "image-upload", data);
    }

    private async checkIfCodecsAreSupported(
        logger: Logger,
        localPath: string,
        mime: string,
    ): Promise<void> {
        const handler = VisualHandlers.get(mime, logger);
        if (!handler) {
            return;
        }
        const PROGRESSIVE_JPEG_LIMIT_PX_BYTES = 19 * 1000 * 1000;
        const metadata = await handler.getMetadata(localPath);
        const mpxBytes = metadata.width * metadata.height;
        if (metadata.isProgressive && mpxBytes > PROGRESSIVE_JPEG_LIMIT_PX_BYTES) {
            throw new UnsupportedMedia(
                TranslationKeys.Visual_ProgressiveJpegTooBig,
                {
                    sizeMb: Math.floor(mpxBytes / 1000 / 1000).toLocaleString(),
                    maxMb: (PROGRESSIVE_JPEG_LIMIT_PX_BYTES / 1000 / 1000).toLocaleString()
                }
            );
        }
    }

    private checkIfVisualIsSupported(mime: string): boolean {
        return VisualHandlers.isVisualTypeSupported(mime, this.logger);
    }

    private writeFile(
        stream: Readable,
        fileName: string,
        onFirstChunkRead: (chunk: Buffer) => Promise<void>,
        onClose: (path: string) => void,
    ) {
        const tmpPath = path.join(tmpdir(), fileName);
        const writeStream = createWriteStream(tmpPath);
        stream.pipe(writeStream);

        let firstChunkRead = false;
        stream.on("data", async (chunk: Buffer) => {
            if (!firstChunkRead) {
                firstChunkRead = true;
                try {
                    await onFirstChunkRead(chunk);
                } catch (e) {
                    this.logger.error(e.message, "visual-upload");
                    stream.unpipe(writeStream);
                    writeStream.end();
                    onClose(tmpPath);
                }
            }
        });
        writeStream.on("close", () => onClose(tmpPath));
    }

    private finishUploadWithSuccess(request: WebRequest, response: Response, data: unknown): void {
        this.logger.debug("Done handling request, sending Visual IDs JSON...", "visual-upload");
        try {
            if (isStreamWritable(response, this.logger, "visual-upload")) {
                response.status(HTTPStatusCode.OK);
                response.set("Content-Type", "application/json");
                response.set("Connection", "close");
                response.send(JSON.stringify(data));
            }
        } catch (error) {
            this.logger.error(error.message, "visual-upload");
        }
        response.end();
        finishRequestTimings(request);
    }

    private endWithBadRequest(request: WebRequest, response: Response, error: Error): void {
        this.logger.warn(error.message, "visual-upload");
        if (isStreamWritable(response, this.logger, "visual-upload")) {
            response.writeHead(HTTPStatusCode.BAD_REQUEST, "Bad Request");
            response.end(JSON.stringify({ ...error, stack: undefined }));
        }
        finishRequestTimings(request);
    }

    private finishUploadWithErrors(request: WebRequest, response: Response, errors: Error[]) {
        errors.forEach(error => this.logger.error(error.message, "visual-upload"));
        if (isStreamWritable(response, this.logger, "visual-upload")) {
            response.set("Connection", "close");
            const { code, body } = this.buildErrorResponse(errors);
            response.status(code);
            response.send(body);
        }
        response.end();
        finishRequestTimings(request);
    }

    private buildErrorResponse(errors: Error[]): { code: number, body: string } {
        const unsupportedMedia = errors.find(isUnsupportedMediaTypeError);
        if (unsupportedMedia) {
            return {
                code: HTTPStatusCode.UNSUPPORTED_MEDIA_TYPE,
                body: JSON.stringify({ ...unsupportedMedia, stack: undefined })
            };
        }
        return {
            code: HTTPStatusCode.INTERNAL_SERVER_ERROR,
            body: JSON.stringify({ ...errors[0], stack: undefined })
        }
    }

    private async ensureSupportedFormat(tmpPath: string, mime: string): Promise<[string, string]> {
        let imagePath: string;
        switch (mime) {
            case "image/heic":
            case "image/heif":
                this.logger.debug("Preprocessing image (convert heic/heif to jpg)", "visual-upload");
                imagePath = await convertImageToDifferentFormat(tmpPath, "jpg");
                return [imagePath, "image/jpeg"];
            case "image/webp":
                this.logger.debug("Preprocessing image (convert webp to gif)", "visual-upload");
                imagePath = await convertImageToDifferentFormat(tmpPath, "gif");
                return [imagePath, "image/gif"];
            case "image/tiff":
                this.logger.debug("Preprocessing image (convert tiff to jpg)", "visual-upload");
                imagePath = await convertTiffToJpg(tmpPath);
                return [imagePath, "image/jpeg"];
            case "video/quicktime":
                this.logger.debug("Preprocessing quictime (possibly strip APAC audio track", "visual-upload");
                imagePath = await maybeStripAPAC(tmpPath, this.logger);
                return [imagePath, mime];
            default:
                return [tmpPath, mime];
        }
    }

    private async ensureRotated(tmpPath: string, mime: string): Promise<string> {
        this.logger.debug("Rotating original", "visual-upload");
        const visualHandler = VisualHandlers.get(mime, this.logger);
        const metadata = await visualHandler.getMetadata(tmpPath)
        return visualHandler.transformOriginal(tmpPath, metadata);
    }

    async restartVideoProcessing(visualId: string): Promise<void> {
        if (!isVideoIdString(visualId)) {
            throw new ProcessingJobRestartError(`Unexpected visual id ${visualId}`);
        }
        const [ video ] = await this.binderVisualRepository.findVisuals({ ids: [ visualId ] }) as Video[];
        if (!video) {
            throw new ProcessingJobRestartError(`Could not find a visual for the passed in id: ${visualId}`);
        }

        const job = await this.fetchValidVisualProcessingJob(visualId);
        incrementVideoProcessingRestartsCounterByOne(visualId, job.step)
        switch (job.step) {
            case ProcessingStep.PENDING_ON_VISUAL:
                this.logger.info(`Nothing to resume, the job for ${visualId} is pending on job for ${job.stepDetails["linkedVideoId"]}`, "restart-video-processing");
                return;
            case ProcessingStep.PREPROCESSING:
            case ProcessingStep.FLAGGED_FOR_REPROCESSING: {
                const restartAsyncVideoProcessingFn = (async () => {
                    try {
                        await this.imageStorage.withLocalCopy(video, VideoFormatType.ORIGINAL, async localFile => {
                            await this.doVideoProcessing(video as Video, localFile.path, job.accountId, { runInBackground: true });
                        });
                    } catch (e) {
                        this.logger.error(`Failed to resume video processing job for ${visualId} (${e.message})`, "restart-video-processing")
                    }
                });
                restartAsyncVideoProcessingFn();
                return;
            }
            case ProcessingStep.TRANSCODING: {
                const videoProcessor = new VideoProcessor(
                    this.logger,
                    new ScreenshotHandler(this.bindersConfig, this.logger, this.imageStorage),
                    this.visualProcessingJobsRepository,
                    this.notificationServiceClient,
                    this.binderVisualRepository,
                    this.bindersConfig,
                    this.updateVisualProcessing.bind(this),
                );
                await videoProcessor.resumeVideoTranscoding(video, job, false);
                return;
            }
            default:
                throw new ProcessingJobRestartError(`Cannot resume background processing for visual ${visualId} with status ${video.status}`);
        }
    }

    private async fetchValidVisualProcessingJob(visualId: string): Promise<VisualProcessingJob> {
        const job = await this.visualProcessingJobsRepository.findJobForVisual(visualId);
        if (job == null) {
            throw new ProcessingJobRestartError(`Could not find a job to restart for visual: ${visualId}`);
        }
        if (wasJobRecentlyUpdated(job)) {
            throw new ProcessingJobRestartError(`Cannot resume a job for visual: ${visualId} that was recently updated`);
        }
        return job;
    }

    async doVisualProcessing(
        visual: Visual,
        visualLocalPath: string,
        accountId: string,
        options: { runInBackground: boolean },
    ): Promise<string> {
        try {
            if (isVideo(visual)) {
                await this.doVideoProcessing(visual, visualLocalPath, accountId, options);
            } else {
                await this.doImageProcessing(visual);
            }
            return visual.id.value();
        } catch (e) {
            throw new Error(`Failed to process visual with id ${visual.id.value()}`, { cause: e });
        }
    }

    async doVideoProcessing(
        currentVideo: Video,
        videoLocalPath: string,
        accountId: string,
        options: { runInBackground: boolean },
    ): Promise<void> {
        const currentVideoId = currentVideo.id.value();
        try {
            await this.createOrRestartJobForVisual(currentVideoId, accountId);
        } catch (error) {
            if (error instanceof ProcessingJobInProgressError) {
                this.logger.info(`Video ${currentVideoId} already has a running job, skipping processing`, "video-processing");
            } else {
                this.logger.error(error.message, "video-processing");
            }
            return;
        }
        const videoToProcess = await this.resolveToOriginalVideo(currentVideo, videoLocalPath);
        const videoToProcessId = videoToProcess.id.value();
        if (videoToProcessId !== currentVideoId) {
            await this.visualProcessingJobsRepository.transitionJob(
                currentVideoId,
                ProcessingStep.PENDING_ON_VISUAL,
                { linkedVisualId: videoToProcessId }
            );
            try {
                await this.createOrRestartJobForVisual(videoToProcessId, accountId);
            } catch (error) {
                if (error instanceof ProcessingJobInProgressError) {
                    this.logger.info(`The original video ${videoToProcessId} job is already running, no need to also run one for ${currentVideoId}`, "video-processing");
                } else {
                    this.logger.error(error.message, "video-processing");
                }
                return;
            }
        }

        await this.binderVisualRepository.updateVisual(videoToProcess.binderId, videoToProcess.id, { status: VisualStatus.PROCESSING });
        const videoProcessor = new VideoProcessor(
            this.logger,
            new ScreenshotHandler(this.bindersConfig, this.logger, this.imageStorage),
            this.visualProcessingJobsRepository,
            this.notificationServiceClient,
            this.binderVisualRepository,
            this.bindersConfig,
            this.updateVisualProcessing.bind(this),
        );
        await videoProcessor.takeInitialScreenshots(videoToProcess, videoLocalPath);
        await videoProcessor.doVideoTranscoding(videoToProcess, accountId, !options.runInBackground);
    }

    /**
     * Attempts to
     *  - create a visual processing job for the passed <code>visualId</code>, when missing
     *  - restart the visual processing job when it wasn't updated recently
     * @returns Promise<void> when it managed to create or restart the job
     * @throws MaxReprocessingRetriesError when the job has reached the maximum number of retries
     * @throws ProcessingJobInProgressError when the job is already in progress
     */
    private async createOrRestartJobForVisual(visualId: string, accountId: string): Promise<void> {
        const storedVisualJob = await this.visualProcessingJobsRepository.findJobForVisual(visualId);

        if (storedVisualJob == null) {
            await this.visualProcessingJobsRepository.createJobForVisual(
                visualId,
                ProcessingStep.PREPROCESSING,
                { accountId }
            );
            return;
        } else {
            if ((storedVisualJob.retries || 0) >= MAX_VIDEO_PROCESSING_RETRIES) {
                await this.visualProcessingJobsRepository.transitionJob(
                    visualId,
                    ProcessingStep.FAILURE,
                    {
                        accountId,
                    }
                );
                this.logger.fatal(`Processing of visual ${visualId} has reached the maximum number of retries - will not be processed`, "visual-processing");
                throw new MaxReprocessingRetriesError(visualId);
            }
            if (!wasJobRecentlyUpdated(storedVisualJob)) {
                await this.visualProcessingJobsRepository.transitionJob(
                    visualId,
                    ProcessingStep.PREPROCESSING,
                    {
                        accountId,
                    },
                    {
                        increaseRetryCount: true,
                    }
                );
                return;
            }
        }
        throw new ProcessingJobInProgressError(visualId);
    }

    async doImageProcessing(storedImage: Image): Promise<void> {
        this.logger.debug(`Processing image (resize): ${storedImage.id.value()}`, "visual-upload");
        const image = await this.resolveToOriginalImage(storedImage);
        const [ binderId, imageId ] = [ image.binderId, image.id.value() ];
        await this.binderVisualRepository.updateVisual(binderId, image.id, { status: VisualStatus.PROCESSING });
        try {
            const formats = await resizeImage(image, this.imageStorage, this.logger);
            await this.updateVisualProcessing(binderId, imageId, formats, VisualStatus.COMPLETED, { updateDuplicatedVisualsFormats: true });
        } catch (error) {
            this.logger.error(`Could not process image: ${binderId}/${imageId}`, "visual-upload", { error });
            await this.binderVisualRepository.updateVisual(binderId, image.id, { status: VisualStatus.ERROR });
            throw error;
        }
    }

    private async resolveToOriginalImage(image: Image): Promise<Image> {
        const originalFormat = image.formats?.find(({ format }) => format === ImageFormatType.ORIGINAL);
        if (!originalFormat) {
            return image;
        }
        // get the binder id and image id from the storage location to use as an override when retrieving the original
        // visual from storage. This is necessary when uploading existing visuals to duplicated documents
        const [ originalBinderId, originalImageId ] = [
            extractItemIdFromAzureStorageLocation(originalFormat.storageLocation),
            extractImageIdFromAzureStorageLocation(originalFormat.storageLocation),
        ];
        if (isVideoIdString(originalImageId)) {
            throw new Error(`Cannot run image processing on video: ${originalImageId}`);
        }
        this.logger.info(`Resolving duplicate image ${image.id.value()} to original ${originalImageId}`, "visual-upload");
        return this.loadVisual(originalBinderId, originalImageId);
    }

    /**
     * In case of a duplicate visual, we'd like to find the original video
     * As an additional step: It ensures the original video file is present in the right container.
     * (we're storing videos in containers matching their visual ID)
     */
    private async resolveToOriginalVideo(currentVideo: Video, currentVideoLocalPath: string): Promise<Video> {
        const originalVisualData = currentVideo.originalVisualData;
        const videoToProcess = originalVisualData ?
            await this.binderVisualRepository.getVisual(originalVisualData.binderId, VisualIdentifier.parse(originalVisualData.originalId)) as Video :
            currentVideo;
        return this.ensureOriginalFormatInContainerWithVideoId(videoToProcess, currentVideoLocalPath);
    }

    private async addVisualFile(
        binderId: string,
        tmpPath: string,
        fullPath: string,
        providedMime: string,
        accountId: string,
        visualSettings?: IVisualsAccountSettings,
        options?: UploadVisualOptions,
    ): Promise<string> {
        try {
            const [ supportedFormatFilePath, mime ] = await this.ensureSupportedFormat(tmpPath, providedMime);
            const rotatedFilePath = await this.ensureRotated(supportedFormatFilePath, mime);
            try {
                const visual = await this.createOrRestoreVisual(
                    binderId,
                    rotatedFilePath,
                    fullPath,
                    mime,
                    visualSettings,
                    options
                );
                return await this.doVisualProcessing(
                    visual,
                    rotatedFilePath,
                    accountId,
                    { runInBackground: true },
                );
            } finally {
                // rotateFilePath overwrites supportedFormatFilePath
                if (tmpPath !== rotatedFilePath) {
                    await safeDeleteFile(rotatedFilePath, this.logger);
                }
            }
        } catch (error) {
            this.logger.error("Failed to process visual", "visual-upload", { error });
            throw error;
        }
    }

    /**
     * Creates a new visual in the image storage or restores an existing one
     */
    private async createOrRestoreVisual(
        binderId: string,
        transformedPath: string,
        fullPath: string,
        mime: string,
        visualSettings: IVisualsAccountSettings,
        options: UploadVisualOptions
    ): Promise<Visual> {
        const visualIdObj = VisualIdentifier.generate(mime);
        const visualId = visualIdObj.value();
        const storageDetails = await this.imageStorage.addFile(
            transformedPath,
            binderId,
            visualIdObj,
            mime,
            ImageFormatType.ORIGINAL,
        );
        try {
            return await this.createVisualWith(
                visualIdObj,
                binderId,
                fullPath,
                storageDetails,
                mime,
                visualSettings ?? {},
                options ?? {},
            );
        } catch (error) {
            if (error.name === "MongoServerError" && error.code === 11000) {
                try {
                    this.logger.warn("Duplicate visual detected", "visual-upload", { message: error.message });
                    const existingVisual = await this.binderVisualRepository.getVisualWithMD5AndCommentId(binderId, storageDetails.md5, options?.commentId);
                    await this.binderVisualRepository.restoreVisual(binderId, existingVisual.id, takeFileNameFromPath(fullPath));
                    return await this.updateVisualDetails(storageDetails, existingVisual, mime, binderId, visualIdObj);
                } catch (e) {
                    throw new Error(`Failed to restore duplicate visual when processing visual with id ${visualId}`, { cause: e });
                }
            } else {
                throw new Error(`Failed to create visual with id ${visualId}`, { cause: error });
            }
        }
    }

    private async createVisualWith(
        visualId: VisualIdentifier,
        binderId: string,
        fullPath: string,
        storageDetails: VisualStorageDetails,
        mime: string,
        visualSettings: Partial<IVisualsAccountSettings>,
        options: UploadVisualOptions,
    ): Promise<Visual> {
        const visualUsage = options.visualUsage || VisualUsage.BinderChunk;
        const pathParts = path.parse(fullPath);
        const visualCreationAttributes: VisualCreationAttributes = {
            binderId,
            mime,
            md5: storageDetails.md5,
            original: storageDetails.format,
            commentId: options.commentId,
            hasAudio: isVideoFormatModel(storageDetails.format) ? !!storageDetails.format.hasAudio : undefined,
            visualId,
            fileName: pathParts.name,
            extension: pathParts.ext.substring(1),
            status: VisualStatus.ACCEPTED,
            fitBehaviour: visualSettings.fitBehaviour ?? "fit",
            bgColor: visualSettings.bgColor ?? "ffffff",
            languageCodes: [],
            audioEnabled: visualSettings.audioEnabled ?? false,
            usage: visualUsage === VisualUsage.BinderChunk ? VisualUsage.BinderChunk : VisualUsage.ReaderComment
        };
        this.logger.debug(`Storing visual in DB: ${JSON.stringify(visualCreationAttributes)}`, "image-upload");
        return this.binderVisualRepository.createVisual(visualCreationAttributes);
    }

    private async updateVisualDetails(
        storageDetails: VisualStorageDetails,
        existingVisual: Visual,
        mime: string,
        binderId: string,
        visualId: VisualIdentifier
    ) {
        const url = storageDetails.format.storageLocation;
        let objectUpdate: VisualUpdate = {};
        if (
            !url.startsWith("azure://") &&
            !LegacyVideoStorage.matchesStorageScheme(url) &&
            !VideoStorage.matchesStorageScheme(url)
        ) {
            objectUpdate = { replaceFormats: [ storageDetails.format ] };
        }
        if (existingVisual.mime !== mime) {
            objectUpdate = { ...objectUpdate, mime };
        }
        const isUpdateEmpty = Object.keys(objectUpdate).length === 0 && objectUpdate.constructor === Object;
        return isUpdateEmpty ?
            existingVisual :
            await this.binderVisualRepository.updateVisual(binderId, visualId, objectUpdate);
    }

    /**
     * In the old AMS storage, videos we're stored in containers using an 'asset-...' format, in the new one
     * the container matches the video id format, so 'vid-...'. Since we'd like to have one code flow when
     * processing both old and new videos, this piece of logic will migrate the old videos from their 'asset-'
     * like format to the 'vid-' like one by updating their ORIGINAL format path. Once the original path is there,
     * the reprocessing flow will ensure that the newly generated formats will be placed in the same container as the
     * ORIGINAL one.
     * NOTE: This piece of logic can be removed once we won't have any videos in the AMS storage
     */
    private async ensureOriginalFormatInContainerWithVideoId(existingVideo: Video, localPath: string): Promise<Video> {
        if (existingVideo.originalVisualData != null) return existingVideo;
        const originalFormat = existingVideo.formats.find(({ format }) => format === VideoFormatType.ORIGINAL);
        // Missing container prop means it's an s3 video
        if (originalFormat.container && !originalFormat.container?.startsWith("asset-")) return existingVideo;

        const formatsExceptOriginal = existingVideo.formats.filter(({ format }) => format !== VideoFormatType.ORIGINAL);
        const storageDetails = await this.imageStorage.addFile(
            localPath,
            existingVideo.binderId,
            existingVideo.id,
            existingVideo.mime,
            VideoFormatType.ORIGINAL,
            undefined,
        );
        return await this.binderVisualRepository.updateVisual(
            existingVideo.binderId,
            existingVideo.id,
            { replaceFormats: [ storageDetails.format, ...formatsExceptOriginal ] }
        ) as Video;
    }

    deleteImage(binderId: string, imageId: string): Promise<void> {
        this.logger.debug(`Deleting visual ${binderId}/${imageId}`, "image-api");
        return this.binderVisualRepository.deleteVisual(binderId, VisualIdentifier.parse(imageId));
    }

    async deleteVisuals(binderId: string, visualIds: string[]): Promise<void> {
        this.logger.debug(`Deleting ${visualIds.length} visuals from Binder ${binderId}`, "image-api");
        await this.binderVisualRepository.softDeleteVisuals(binderId, visualIds.map(VisualIdentifier.parse));
    }

    hardDeleteVisual(binderId: string, visualId: string): Promise<void> {
        this.logger.debug(`Hard deleting visual ${binderId}/${visualId}`, "image-api");
        return this.binderVisualRepository.hardDeleteVisual(binderId, VisualIdentifier.parse(visualId));
    }

    hardDeleteVisuals(filter: { binderIds: string[] }): Promise<void> {
        return this.binderVisualRepository.hardDeleteVisuals(filter);
    }

    updateVisualFitBehaviour(
        binderId: string,
        visualId: string,
        newFitBehaviour: ImageFitBehaviour
    ): Promise<ClientImage> {
        this.logger.debug(`Updating visual ${binderId}/${visualId} fitBehaviour to ${newFitBehaviour}`, "image-api");
        const visualIdObject = VisualIdentifier.parse(visualId);
        const toClientVisual: (Image) => ClientImage = this.toClientVisual.bind(this);
        return this.binderVisualRepository
            .updateVisual(binderId, visualIdObject, { fitBehaviour: newFitBehaviour })
            .then(toClientVisual);
    }

    updateVisualBgColor(binderId: string, visualId: string, newBgColor: string): Promise<ClientImage> {
        this.logger.debug(`Updating visual ${binderId}/${visualId} bgColor to ${newBgColor}`, "image-api");
        const visualIdObject = VisualIdentifier.parse(visualId);
        const toClientVisual: (Image) => ClientImage = this.toClientVisual.bind(this);
        return this.binderVisualRepository
            .updateVisual(binderId, visualIdObject, { bgColor: newBgColor })
            .then(toClientVisual);
    }

    updateVisualRotation(binderId: string, visualId: string, rotation: ImageRotation): Promise<ClientImage> {
        this.logger.debug(`Updating visual ${binderId}/${visualId} rotation to ${rotation}`, "image-api");
        const visualIdObject = VisualIdentifier.parse(visualId);
        const toClientVisual: (Image) => ClientImage = this.toClientVisual.bind(this);
        return this.binderVisualRepository
            .updateVisual(binderId, visualIdObject, { rotation })
            .then(toClientVisual);
    }

    updateVisualLanguageCodes(binderId: string, visualId: string, languageCodes: string[]): Promise<ClientImage> {
        this.logger.debug(`Updating visual ${binderId}/${visualId} languageCodes to ${languageCodes}`, "image-api");
        const visualIdObject = VisualIdentifier.parse(visualId);
        const toClientVisual: (Image) => ClientImage = this.toClientVisual.bind(this);
        return this.binderVisualRepository
            .updateVisual(binderId, visualIdObject, { languageCodes })
            .then(toClientVisual);
    }

    async updateVisualAudio(
        binderId: string,
        visualId: string,
        audioEnabled: boolean,
    ): Promise<ClientImage> {
        this.logger.debug(`Updating visual ${binderId}/${visualId} audio enabled to ${audioEnabled}`, "image-api");
        const visualIdObject = VisualIdentifier.parse(visualId);
        const update = await this.binderVisualRepository.updateVisual(binderId, visualIdObject, { audioEnabled })
        return this.toClientVisual(update);
    }

    async updateVisualAutoPlay(
        binderId: string,
        visualId: string,
        autoPlay: boolean
    ): Promise<ClientImage> {
        const visualIdObject = VisualIdentifier.parse(visualId);
        const update = await this.binderVisualRepository.updateVisual(binderId, visualIdObject, { autoPlay });
        return this.toClientVisual(update);
    }

    async patchVisual(
        binderId: string,
        visualId: string,
        changes: VisualUpdate
    ): Promise<ClientImage> {
        const visualIdObject = VisualIdentifier.parse(visualId);
        const update = await this.binderVisualRepository.updateVisual(binderId, visualIdObject, changes);
        return this.toClientVisual(update);
    }

    updateImageBgColor(binderId: string, imageId: string, newBgColor: string): Promise<ClientImage> {
        return this.updateVisualBgColor(binderId, imageId, newBgColor);
    }

    private async updateFormatsAndStatusForVisual(
        binderId: string,
        visualIdentifier: VisualIdentifier,
        formats: Pick<VisualUpdate, "extraFormats"> | Pick<VisualUpdate, "replaceFormats">,
        status: VisualStatus,
        streamingInfo?: StreamingInfo,
    ): Promise<Visual> {
        const visualId = visualIdentifier.value();
        const formatsLength: number = (formats["extraFormats"] ?? formats["replaceFormats"]).length;
        this.logger.debug(`Completing visual ${binderId}/${visualId} (${formatsLength} new formats${streamingInfo?.manifestPaths ? ` + ${streamingInfo.manifestPaths.length} new manifest paths` : ""})`, "image-api");
        const updatedVisual = await this.binderVisualRepository.updateVisual(binderId, visualIdentifier, {
            status,
            streamingInfo,
            ...formats,
        });
        if (isVideoIdString(visualId) && (status === VisualStatus.COMPLETED || status === VisualStatus.ERROR)) {
            await this.visualProcessingJobsRepository.deleteJobForVisual(visualId);
        }
        return updatedVisual;
    }

    private async updateVisualProcessing(
        binderId: string,
        visualId: string,
        formats: ClientFormat[],
        visualStatus: VisualStatus,
        options?: { updateDuplicatedVisualsFormats?: boolean },
        streamingInfo?: StreamingInfo,
    ): Promise<void> {
        const visualIdentifier = VisualIdentifier.parse(visualId);
        const extraFormats = await Promise.all(
            formats.map(format => this.fromClientFormat(binderId, visualIdentifier, format))
        );
        const updatedVisual = await this.updateFormatsAndStatusForVisual(
            binderId,
            visualIdentifier,
            { extraFormats },
            visualStatus,
            streamingInfo
        );
        if (options?.updateDuplicatedVisualsFormats) {
            await this.updateDuplicatedVisualsFormats(updatedVisual);
        }
    }

    private async updateDuplicatedVisualsFormats(originalVisual: Visual): Promise<void> {
        const duplicatedVisuals = await this.binderVisualRepository.getAllVisualsByOriginalVisualData(originalVisual.binderId, originalVisual.id.value());
        this.logger.debug(`${duplicatedVisuals.length} duplicates found of this visual, completing formats/manifest info in these as well`, "image-api");
        const duplicatedVisualsBatches = splitEvery(5, duplicatedVisuals);
        for (const duplicatedVisualBatch of duplicatedVisualsBatches) {
            await Promise.all(duplicatedVisualBatch.map(duplicatedVisual =>
                this.updateFormatsAndStatusForVisual(
                    duplicatedVisual.binderId,
                    duplicatedVisual.id,
                    { replaceFormats: originalVisual.formats },
                    originalVisual.status,
                    originalVisual.streamingInfo
                )));
        }
    }

    private async fromClientFormat(binderId: string, visualId: VisualIdentifier, format: ClientFormat): Promise<VisualFormat> {
        const visualFormatType = stringToVisualFormatType(format.name);
        if (visualFormatType === undefined) {
            throw new InvalidArgument(`Invalid image format ${format.name}`);
        }
        let storageURL = format.url;
        if (!storageURL || storageURL === "fake") {
            const storageURLObj = await this.imageStorage.getStorageURL(binderId, visualId, visualFormatType);
            storageURL = storageURLObj.value;
        }

        if (isVideoFormat(format)) {
            return new VideoFormat(
                visualFormatType,
                format.width,
                format.height,
                format.size,
                SupportedVideoCodec[format.videoCodec.toUpperCase()],
                format.audioCodec ? SupportedAudioCodec[format.audioCodec.toUpperCase()] : undefined,
                storageURL,
                format.container,
                format.durationInMs,
                this.logger,
            );
        } else {
            return new ImageFormat(
                visualFormatType,
                format.width,
                format.height,
                format.size,
                storageURL,
                format.container,
                this.logger,
                format.keyFramePosition
            );
        }
    }

    private getVisualUrl(binderId: string, visualId: VisualIdentifier, imageFormat: ImageFormat, skipUrlRewrite?: boolean) {
        return (imageFormat.storageLocation.startsWith("https://s3.") || (skipUrlRewrite === true)) ?
            imageFormat.storageLocation :
            this.urlBuilder.getVisualURL(binderId, visualId, imageFormat.format);
    }

    private getVisualStorageBlobName(storageLocation: string) {
        if (VideoStorage.matchesStorageScheme(storageLocation)) {
            // Remove the scheme and the container, and only keep the path
            return storageLocation
                .replace(VideoStorage.getScheme(), "")
                .split("/")
                .slice(1)
                .join("/");
        }
        return storageLocation.split("/").pop();
    }

    private toClientImageFormat(binderId: string, visualId: VisualIdentifier, imageFormat: ImageFormat, skipUrlRewrite?: boolean): ClientFormat {
        return {
            name: visualFormatTypeToString(imageFormat.format),
            width: imageFormat.width,
            height: imageFormat.height,
            size: imageFormat.size,
            blobName: this.getVisualStorageBlobName(imageFormat.storageLocation),
            url: this.getVisualUrl(binderId, visualId, imageFormat, skipUrlRewrite),
            itemIdFromStorageLocation: extractItemIdFromAzureStorageLocation(imageFormat.storageLocation),
            visualIdFromStorageLocation: extractImageIdFromAzureStorageLocation(imageFormat.storageLocation),
            container: imageFormat.container || extractContainerFromAzureStorageLocation(imageFormat.storageLocation),
            keyFramePosition: imageFormat.keyFramePosition
        };
    }

    private toClientVideoFormat(
        binderId: string,
        videoId: VideoIdentifier,
        videoFormat: VideoFormat,
        skipUrlRewrite?: boolean
    ): ClientVideoFormat {
        const url = (skipUrlRewrite === true) ?
            videoFormat.storageLocation :
            this.urlBuilder.getVisualURL(binderId, videoId, videoFormat.format);

        return {
            name: VideoFormatType[videoFormat.format],
            width: videoFormat.width,
            height: videoFormat.height,
            size: videoFormat.size,
            durationInMs: Number.isNaN(videoFormat.durationInMs) ? undefined : videoFormat.durationInMs,
            videoCodec: SupportedVideoCodec[videoFormat.videoCodec] && SupportedVideoCodec[videoFormat.videoCodec].toLowerCase(),
            audioCodec: SupportedAudioCodec[videoFormat.audioCodec] && SupportedAudioCodec[videoFormat.audioCodec].toLowerCase(),
            url,
            blobName: this.getVisualStorageBlobName(videoFormat.storageLocation),
            container: videoFormat.container,
        };
    }

    private toClientVisualFormat(
        binderId: string,
        visualId: VisualIdentifier,
        visualFormat: VisualFormat,
        skipUrlRewrite?: boolean
    ): ClientFormat {
        if (visualId instanceof ImageIdentifier || isScreenshotFormat(visualFormat.format)) {
            return this.toClientImageFormat(binderId, visualId, visualFormat, skipUrlRewrite);
        }
        return this.toClientVideoFormat(binderId, visualId as VideoIdentifier, visualFormat as VideoFormat, skipUrlRewrite);
    }

    private toClientFormats(
        formats: Array<ImageFormat | VideoFormat>,
        resourceId: string,
        visualId: ImageIdentifier | VideoIdentifier,
        skipUrlRewrite?: boolean,
    ): ClientFormat[] {
        return formats.map(format => {
            return this.toClientVisualFormat(resourceId, visualId, format, skipUrlRewrite)
        });
    }

    private buildVisualUrls(
        formats: ClientFormat[],
        resourceId: string,
        visualId: ImageIdentifier | VideoIdentifier,
    ): { [format: string]: string } {
        return formats.reduce((out, format) => {
            out[format.name.toLowerCase()] = format.url;
            return out;
        }, {
            bare: this.urlBuilder.getVisualURL(resourceId, visualId, undefined)
        });
    }

    private toClientVisual(
        visual: Visual,
        skipUrlRewrite?: boolean,
    ): ClientVisual {
        const scheme = visual.formats[0].storageLocation.split("//")[0];
        const clientFormats = this.toClientFormats(visual.formats, visual.binderId, visual.id, skipUrlRewrite);
        const urls = this.buildVisualUrls(clientFormats, visual.binderId, visual.id);
        const isVideo = visual.id instanceof VideoIdentifier;
        const manifestUrls = visual?.streamingInfo?.manifestPaths.map(p => `https://${visual.streamingInfo.streamingHostname}${p}`);
        const clientVisual = {
            id: visual.id.value(),
            ...(visual.formats && visual.formats.length ? { idFromStorageLocation: extractIdFromUrl(visual.formats[0].storageLocation) } : {}),
            kind: isVideo ? VisualKind.VIDEO : VisualKind.IMAGE,
            binderId: visual.binderId,
            filename: visual.filename,
            created: visual.created.toISOString(),
            extension: visual.extension,
            mime: visual.mime,
            fitBehaviour: visual.fitBehaviour ? visual.fitBehaviour : "fit",
            bgColor: visual.bgColor ? visual.bgColor : "eee",
            rotation: visual.rotation !== undefined ? visual.rotation : undefined,
            languageCodes: visual.languageCodes || [],
            status: visual.status,
            md5: visual.md5,
            formats: clientFormats,
            scheme,
            urls,
            audioEnabled: visual.audioEnabled || false,
            autoPlay: visual.autoPlay !== false, // true by default
            manifestUrls,
        };
        for (const optionalProp of ["originalVisualData", "chunkId", "publicationId", "commentId"]) {
            if (optionalProp in visual) {
                clientVisual[optionalProp] = visual[optionalProp];
            }
        }
        return clientVisual;
    }

    downloadFont(name: string, weight: string, style: string, request: WebRequest, response: Response): Promise<void> {
        const fontStorage: FontStorage = request.fontStorage;
        return fontStorage.sendFontFileWithExpress(name, weight, style, response);
    }

    downloadFontFace(name: string, request: WebRequest, response: Response, _next: NextFunction): Promise<void> {
        const fontStorage: FontStorage = request.fontStorage;
        return fontStorage.sendFontFaceFileWithExpress(name, response);
    }

    getImageStorage(): MediaStorage {
        return this.imageStorage;
    }
}

export class ImageServiceBuilder implements ImageServiceContractBuilder {
    constructor(
        private binderVisualRepositoryFactory: BinderVisualRepositoryFactory,
        private videoIndexerRepositoryFactory: IVideoIndexerRepositoryFactory,
        private readonly visualProcessingJobsRepositoryFactory: VisualProcessingJobsRepositoryFactory,
        private urlBuilder: URLBuilder,
        private credentialServiceClient: CredentialServiceContract,
        private notificationServiceClient: NotificationServiceContract,
        private accountServiceClient: AccountServiceContract,
        private bindersConfig: BindersConfig,
        private accountSettingsRedisClient: RedisClient
    ) { }

    build(request: WebRequest): ImageService {
        const { logoStorage, logger, imageStorage } = request;
        return this.buildRequestless(logoStorage, logger, imageStorage);
    }

    buildRequestless(
        logoStorage: AzureItemStorage,
        logger: Logger,
        imageStorage: MultiStorage,
    ): ImageService {
        return new ImageService(
            logger,
            this.getBinderVisualRepo(logger),
            this.videoIndexerRepositoryFactory.build(logger),
            this.visualProcessingJobsRepositoryFactory.build(logger),
            imageStorage,
            logoStorage,
            this.urlBuilder,
            this.bindersConfig,
            this.getImageServiceBaseUri(this.bindersConfig),
            this.credentialServiceClient,
            this.notificationServiceClient,
            this.accountServiceClient,
            this.getCachingAccountServiceClient(logger)
        );
    }

    private getCachingAccountServiceClient(logger: Logger) {
        const { options } = ACCOUNT_SERVICE_CACHE_OPTIONS;
        return RedisCacheBuilder.getProxy(
            this.accountSettingsRedisClient, options,
            this.accountServiceClient, logger
        );
    }

    private getImageServiceBaseUri(config: BindersConfig): string {
        const externalLocationKey = BindersConfig.getServiceExternalLocationKey("image");
        const prefixKey = BindersConfig.getServicePrefixKey("image");
        const hostMaybe: Maybe<string> = config.getString(externalLocationKey);
        const prefixMaybe: Maybe<string> = config.getString(prefixKey);
        return `${trimSlashes(hostMaybe.get())}/${trimSlashes(prefixMaybe.get())}/v1`;
    }

    private withService<T>(request: WebRequest, serviceMethod: (service: ImageService) => Promise<T>): Promise<T> {
        const service = this.build(request);
        return serviceMethod(service);
    }

    queryVideoDurations(request: WebRequest, videoIds: string[]): Promise<VideoDuration> {
        return this.withService(request, service => service.queryVideoDurations(videoIds));
    }

    async manifestProxy(assetId: string, qualityLevel: string, manifestUrl: string, token: string, streamingHostname: string, request: WebRequest, response: express.Response): Promise<void> {
        const azureUrl = `https://${streamingHostname}/${assetId}/ORIGINAL.ism/${qualityLevel}/${manifestUrl}`;
        const rs = await superagent.get(azureUrl);
        const manifest = rs.body.toString();
        const rewrittenManifest = manifest
            .replace(/URI="(.*\?kid=.*)"/g, `URI="$1&token=${token}"`)
            .replace(/^(Fragments\(.*\)).*$/gm, `https://${streamingHostname}/${assetId}/ORIGINAL.ism/${qualityLevel}/$1`);
        response.status(200);
        response.setHeader("content-type", getManifestContentType(rs));
        response.send(rewrittenManifest);
    }

    async hlsProxy(
        targetUrl: string,
        token: string,
        response: express.Response,
        logger?: Logger
    ): Promise<void> {

        if (!isSafeForRedirect(targetUrl)) {
            response.status(400).send("Unsafe url provided");
            return;
        }
        const imageServiceBaseUrl = BindersServiceClientConfig.getLocation(this.bindersConfig, "image", { useExternalLocation: true });

        // If the url is not a manifest file, we can assume it is a video segment
        if (!targetUrl.includes(".m3u8")) {
            const videoUrl = addTokenToUrl(targetUrl, token);
            response.status(302).redirect(videoUrl)
            return;
        }

        const manifestResponse = await fetch(addTokenToUrl(targetUrl, token));
        // If we can't fetch the url from the proxy, it'll usually be because there is something wrong with the url
        if (manifestResponse.status !== 200) {
            response.status(400).send("Invalid url provided");
            logger?.error(`Failed to fetch manifest from ${targetUrl}`, "hlsProxy");
            return;
        }
        const manifest = await manifestResponse.text();
        const parsedManifest = rewriteManifest(manifest, targetUrl, token, imageServiceBaseUrl);

        response.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
        response.setHeader("Content-Length", parsedManifest.length);
        response.send(parsedManifest);
    }

    async downloadManifest(
        assetId: string,
        manifestUrl: string,
        token: string,
        streamingHostname: string,
        _request: WebRequest,
        response: express.Response,
        _next: express.NextFunction
    ): Promise<void> {
        const fullManifestUrl = `https://${streamingHostname}/${assetId}/ORIGINAL.ism/${manifestUrl}`;
        const rs = await superagent.get(fullManifestUrl);
        const manifest = rs.body.toString();
        const rewrittenManifest = manifest
            .replace(/QualityLevels(\([0-9]+\))\/Manifest(\(.+\))/g, `QualityLevels$1/Manifest$2?token=${token}&streamingHostname=${streamingHostname}`);
        response.status(200);
        response.setHeader("content-type", getManifestContentType(rs));
        response.send(rewrittenManifest);
    }

    async getBinderIdsForVisualIds(request: WebRequest, visualIds: string[]): Promise<string[]> {
        return this.withService(request, service => service.getBinderIdsForVisualIds(visualIds));
    }

    composeVisualFormatUrls(request: WebRequest, visualIds: string[], options: IVisualSearchOptions): Promise<IVisualFormatUrlMap> {
        return this.withService(request, service => service.composeVisualFormatUrls(visualIds, options));
    }

    videoIndexerCallback(request: WebRequest, id: string, state: string): Promise<void> {
        return this.withService(request, service => service.videoIndexerCallback(id, state));
    }

    findVideoIndexerResults(request: WebRequest, filter: IVideoIndexerResultFilter): Promise<IVideoIndexerResult[]> {
        return this.withService(request, service => service.findVideoIndexerResults(filter));
    }

    indexVideo(request: WebRequest, visualId: string, accountId: string): Promise<void> {
        return this.withService(request, service => service.indexVideo(visualId, accountId));
    }

    listVisuals(request: WebRequest, binderId: string, options: IVisualSearchOptions = {}): Promise<Array<ClientImage>> {
        return this.withService(request, service => service.listVisuals(binderId, options));
    }

    getFeedbackAttachmentVisuals(request: WebRequest, binderId: string, options: IVisualSearchOptions = {}): Promise<ClientVisual[]> {
        return this.withService(request, service => service.getFeedbackAttachmentVisuals(binderId, options));
    }

    getVisual(request: WebRequest, binderId: string, visualId: string): Promise<ClientVisual> {
        return this.withService(request, service => service.getVisual(binderId, visualId));
    }

    getVisualByOriginalVisualData(request: WebRequest, originaBinderId: string, originalVisualId: string, binderId: string): Promise<ClientVisual> {
        return this.withService(request, service => service.getVisualByOriginalVisualData(originaBinderId, originalVisualId, binderId));
    }

    createVideoSasTokens(request: WebRequest, videoIds: string[]): Promise<Record<string, string>> {
        return this.withService(request, service => service.createVideoSasTokens(videoIds));
    }

    async getVisualIdByImageUrl(request: WebRequest, url: string): Promise<string> {
        return this.withService(request, service => service.getVisualIdByImageUrl(url));
    }

    ensureScreenshotAt(request: WebRequest, binderId: string, visualId: string, timestampMs: number, accountId: string): Promise<void> {
        return this.withService(request, service => service.ensureScreenshotAt(binderId, visualId, timestampMs, accountId));
    }

    async duplicateVisuals(request: WebRequest, binderId: string, targetId: string): Promise<Array<DuplicatedVisual>> {
        request.logger.debug(`duplicateVisuals source: ${binderId} on target: ${targetId}`, "duplicate-visuals");
        return await this.withService<Array<DuplicatedVisual>>(request, service =>
            service.duplicateVisuals(binderId, targetId)
        );
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
    addLogo(accountId: string, attachments: any, request: WebRequest, response: express.Response, next: express.NextFunction): Promise<Logo> {
        return this.withService<Logo>(request, (service) => {
            return service.addLogo(accountId, attachments, request, response, next);
        });
    }

    uploadVisual(
        binderId: string,
        _: UploadableFile[],
        accountId: string,
        request: WebRequest,
        response: express.Response,
        next: express.NextFunction,
        options: UploadVisualOptions,
    ): Promise<Array<string>> {
        return this.withService<Array<string>>(request, service =>
            service.uploadVisual(binderId, _, accountId, request, response, next, options)
        );
    }

    deleteImage(request: WebRequest, binderId: string, imageId: string): Promise<void> {
        return this.withService<void>(request, service => service.deleteImage(binderId, imageId));
    }

    deleteVisuals(request: WebRequest, binderId: string, visualIds: string[]): Promise<void> {
        return this.withService<void>(request, service => service.deleteVisuals(binderId, visualIds));
    }

    hardDeleteVisual(request: WebRequest, binderId: string, visualId: string): Promise<void> {
        return this.withService<void>(request, service => service.hardDeleteVisual(binderId, visualId));
    }

    hardDeleteVisuals(request: WebRequest, filter: { binderIds: string[] }): Promise<void> {
        return this.withService<void>(request, service => service.hardDeleteVisuals(filter));
    }

    updateVisualFitBehaviour(
        request: WebRequest,
        binderId: string,
        imageId: string,
        newFitBehaviour: ImageFitBehaviour
    ): Promise<ClientVisual> {
        return this.withService<ClientImage>(request, service =>
            service.updateVisualFitBehaviour(binderId, imageId, newFitBehaviour)
        );
    }

    updateVisualRotation(
        request: WebRequest,
        binderId: string,
        imageId: string,
        rotation: string
    ): Promise<ClientVisual> {
        const newRotation: ImageRotation = <ImageRotation>parseInt(rotation, 10);
        return this.withService<ClientVisual>(request, service =>
            service.updateVisualRotation(binderId, imageId, newRotation)
        );
    }

    updateImageBgColor(request: WebRequest, binderId: string, imageId: string, newBgColor: string): Promise<ClientImage> {
        return this.withService<ClientImage>(request, service =>
            service.updateImageBgColor(binderId, imageId, newBgColor)
        );
    }

    updateVisualBgColor(request: WebRequest, binderId: string, visualId: string, newBgColor: string): Promise<ClientVisual> {
        return this.updateImageBgColor(request, binderId, visualId, newBgColor);
    }

    updateVisualLanguageCodes(
        request: WebRequest,
        binderId: string,
        visualId: string,
        languageCodes: string[]
    ): Promise<ClientVisual> {
        return this.withService<ClientImage>(request, service =>
            service.updateVisualLanguageCodes(binderId, visualId, languageCodes)
        );
    }

    updateVisualAudio(
        request: WebRequest,
        binderId: string,
        visualId: string,
        audioEnabled: boolean,
    ): Promise<ClientVisual> {
        return this.withService<ClientImage>(request, service =>
            service.updateVisualAudio(binderId, visualId, audioEnabled)
        );
    }

    updateVisualAutoPlay(
        request: WebRequest,
        binderId: string,
        visualId: string,
        autoPlay: boolean
    ): Promise<ClientVisual> {
        return this.withService<ClientImage>(request, service =>
            service.updateVisualAutoPlay(binderId, visualId, autoPlay)
        );
    }

    restartVideoProcessing(request: WebRequest): Promise<void> {
        return this.withService<void>(request, service =>
            service.restartVideoProcessing(request.body.visualId)
        );
    }

    getBinderVisualRepo(logger: Logger): VisualRepository {
        return this.binderVisualRepositoryFactory.build(logger);
    }

    async downloadScreenshot(
        binderId: string,
        visualId: string,
        keyFrame: string,
        format: string,
        request: WebRequest,
        response: Response,
        next: NextFunction,
        _width: number = undefined,
        _height: number = undefined,
    ): Promise<void> {
        const visualIdObject = VisualIdentifier.parse(visualId);
        const forceDownload = request.query.forceDownload;
        const visual = await this.getBinderVisualRepo(request.logger).getVisual(binderId, visualIdObject);

        try {
            request.logger.debug(`Sending screenshot ${binderId}/${visualId} ${format}`, "image-download");
            const mimeToUse = forceDownload ? "application/octet-stream" : "image/png";
            const formatToUse = stringToVisualFormatType(format.toUpperCase());
            const options = {
                ...this.extractMediaRequestOptions(request),
                fileName: keyFrame,
                mime: mimeToUse
            };

            const visualStorage = request.imageStorage;

            const sendFile = visualStorage.sendFileWithExpress.bind(visualStorage);
            if (forceDownload) {
                // Fix not being able to download images with non-ascii characters bug
                // Check https://blog.fastmail.com/2011/06/24/download-non-english-filenames/
                // for why the attachment has to be sent this way
                const fileName = `${encodeURI(visual.filename)}.png`;
                response.set(
                    "Content-Disposition",
                    `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
                );
            }
            return sendFile(visual, formatToUse, options, response, next);
        } catch (e) {
            request.logger.fatal(
                "Could not send the file: " + e.message,
                "image-download",
                { stack: e.stack },
            );
            if (e.name === EntityNotFound.errorName || e.code === "ENOENT" || e.code === "NotFound") {
                response.status(HTTPStatusCode.NOT_FOUND);
                response.send(JSON.stringify({ error: e.message }));
            } else {
                response.status(HTTPStatusCode.INTERNAL_SERVER_ERROR);
                response.send(JSON.stringify({ error: "An unknown error occurred" }));
            }
        }
    }

    downloadLogo(accountId: string, logoId: string, request: WebRequest, response: express.Response, _next: express.NextFunction): Promise<void> {
        const logoStorage: AzureItemStorage = request.logoStorage;
        const logoIdentifier = new LogoIdentifier(logoId);
        const fileName = `${accountId}/${logoIdentifier.value()}`;
        return logoStorage.sendFileWithExpress(fileName, response);
    }

    downloadVideoBestFit(
        binderId: string,
        visualId: string,
        viewportWidth: number,
        viewportHeight: number,
        request: WebRequest,
        response: Response,
        next: NextFunction
    ): Promise<void> {
        const visualIdObject = VisualIdentifier.parse(visualId);
        const visualFormatTypes = [
            VideoFormatType.VIDEO_SCREENSHOT_BIG,
            VideoFormatType.VIDEO_SCREENSHOT,
        ];
        return this.getBinderVisualRepo(request.logger)
            .getVisual(binderId, visualIdObject)
            .then(visual => {
                const image = <Image>visual;
                const availableFormats = image.formats;
                for (const formatCandidate of visualFormatTypes) {
                    const availableFormat = availableFormats.find(af => af.format === formatCandidate);
                    if (availableFormat) {
                        if (Math.min(availableFormat.width, availableFormat.height) > Math.max(viewportWidth, viewportHeight)) {
                            request.logger.debug(
                                `Determined ${availableFormat} as best fit for dimensions ${viewportWidth} x ${viewportHeight}`,
                                "image-download"
                            );
                            return this.downloadVisual(binderId, visualId, VideoFormatType[availableFormat.format], request, response, next);
                        } else if ((viewportWidth === undefined) || (viewportHeight === undefined)) {
                            return this.downloadVisual(binderId, visualId, VideoFormatType[availableFormat.format], request, response, next);
                        }
                    }
                }
                return this.downloadVisual(binderId, visualId, "video_screenshot", request, response, next);
            });
    }

    async downloadImageBestFit(
        binderId: string,
        visualId: string,
        viewportWidth: number,
        viewportHeight: number,
        request: WebRequest,
        response: Response,
        next: NextFunction): Promise<void> {
        const visualIdObject = VisualIdentifier.parse(visualId);
        const visualFormatTypes = [
            ImageFormatType.TINY,
            ImageFormatType.THUMBNAIL,
            ImageFormatType.MEDIUM,
            ImageFormatType.MEDIUM2,
            ImageFormatType.BIG,
            ImageFormatType.HUGE,
        ];
        const visual = await this.getBinderVisualRepo(request.logger).getVisual(binderId, visualIdObject)
        const image = <Image>visual;
        const availableFormats = image.formats;
        for (const formatCandidate of visualFormatTypes) {
            const availableFormat = availableFormats.find(af => af.format === formatCandidate);
            if (availableFormat) {
                if (Math.min(availableFormat.width, availableFormat.height) > Math.max(viewportWidth, viewportHeight)) {
                    request.logger.debug(
                        `Determined ${availableFormat} as best fit for dimensions ${viewportWidth} x ${viewportHeight}`,
                        "image-download"
                    );
                    return this.downloadVisual(binderId, visualId, ImageFormatType[availableFormat.format], request, response, next);
                } else if ((viewportWidth === undefined) || (viewportHeight === undefined)) {
                    return this.downloadVisual(binderId, visualId, ImageFormatType[availableFormat.format], request, response, next);
                }
            }
        }
        return this.downloadVisual(binderId, visualId, "original", request, response, next);
    }

    downloadVisualBestFit(
        binderId: string,
        visualId: string,
        viewportWidth: number,
        viewportHeight: number,
        request: WebRequest,
        response: Response,
        next: NextFunction
    ): Promise<void> {
        if (isVideoIdString(visualId)) {
            return this.downloadVideoBestFit(binderId, visualId, viewportWidth, viewportHeight, request, response, next);
        }
        return this.downloadImageBestFit(binderId, visualId, viewportWidth, viewportHeight, request, response, next);
    }

    getMime(visualMime: string, isScreenshotRequest: boolean, isVideo: boolean): string {
        if (isVideo) {
            return "video/mp4";
        }
        if (isScreenshotRequest) {
            return "image/png";
        }
        return visualMime || "image/png";
    }

    async downloadVisual(
        binderId: string,
        visualId: string,
        formatName: string,
        request: WebRequest,
        response: Response,
        next: NextFunction,
    ): Promise<void> {
        const visualIdObject = VisualIdentifier.parse(visualId);
        const forceDownload = request.query.forceDownload;
        try {
            const visual = await this.getBinderVisualRepo(request.logger).getVisual(binderId, visualIdObject);
            request.logger.debug(`Sending visual ${binderId}/${visualId} ${formatName}`, "image-download");
            const formatType = stringToVisualFormatType(formatName.toUpperCase());
            const format = (visual.formats as VisualFormat[]).find(f => f.format === formatType);

            const isScreenshotRequest = isScreenshotFormat(formatType);

            const isVideo = format && (format["videoCodec"] !== undefined && format["videoCodec"] !== null);
            const mime = this.getMime(visual.mime, isScreenshotRequest, isVideo);

            const options = this.extractMediaRequestOptions(request);
            options.mime = mime;

            if (isScreenshotRequest) {
                const initiallyAvailableScreenshotFormats = [
                    VideoFormatType.VIDEO_SCREENSHOT_BIG,
                    VideoFormatType.VIDEO_SCREENSHOT,
                ] as VisualFormatType[];
                if (!initiallyAvailableScreenshotFormats.includes(formatType)) {
                    options["fileName"] = "1";
                }
            }
            const visualStorage = request.imageStorage;
            const sendFile = visualStorage.sendFileWithExpress.bind(visualStorage);
            if (forceDownload) {
                // Fix not being able to download images with non-ascii characters bug
                // Check https://blog.fastmail.com/2011/06/24/download-non-english-filenames/
                // for why the attachment has to be sent this way
                const fileName = `${encodeURI(visual.filename)}.${visual.extension}`;
                response.set(
                    "Content-Disposition",
                    `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
                );
            }
            await sendFile(visual, formatType, options, response, next);
            finishRequestTimings(request);

            if (request.logger) {
                request.logger.info(
                    "Request finished",
                    "request",
                    {
                        url: request.url,
                        method: request.method,
                        status: 200,
                        timings: request.timings,
                    }
                );
            }
        } catch (e) {
            finishRequestTimings(request);
            const notFound = (e.name === EntityNotFound.errorName || e.code === "ENOENT" || e.code === "NotFound");
            const statusCode = notFound ?
                HTTPStatusCode.NOT_FOUND :
                HTTPStatusCode.INTERNAL_SERVER_ERROR;

            request.logger.fatal(
                "Could not send the file: " + e.message,
                "image-download",
                {
                    url: request.url,
                    method: request.method,
                    status: statusCode,
                    timings: request.timings,
                    stack: e.stack,
                }
            );
            if (isStreamWritable(response, request.logger, "image-download")) {
                if (notFound) {
                    response.status(statusCode);
                    response.send(JSON.stringify({ error: e.message }));
                } else {
                    response.status(statusCode);
                    response.send(JSON.stringify({ error: "An unknown error occurred" }));
                }
            }
        }
    }

    downloadFont(name: string, weight: string, style: string, request: WebRequest, response: Response, _next: NextFunction): Promise<void> {
        const fontStorage: FontStorage = request.fontStorage;
        return fontStorage.sendFontFileWithExpress(name, weight, style, response);
    }

    downloadFontFace(name: string, request: WebRequest, response: Response, _next: NextFunction): Promise<void> {
        const fontStorage: FontStorage = request.fontStorage;
        return fontStorage.sendFontFaceFileWithExpress(name, response);
    }

    private extractMediaRequestOptions(request: WebRequest): IExpressResponseOptions {
        let match = {};
        if (request.headers["range"] && (match = request.headers["range"].match(RANGE_HEADER_PATTERN))) {
            match["range"] = {
                start: match[1] !== "" ? Maybe.just(parseInt(match[1])) : Maybe.nothing<number>(),
                stop: match[2] !== "" ? Maybe.just(parseInt(match[2])) : Maybe.nothing<number>()
            };
        }
        if (request.headers["if-match"]) {
            match["requiredEtag"] = request.headers["if-match"];
        }
        return match;
    }
}


function getManifestContentType(rs: Request) {
    return rs?.headers["content-type"] || "application/vnd.apple.mpegurl";
}

function wasJobRecentlyUpdated(job: VisualProcessingJob) {
    return differenceInSeconds(Date.now(), job.updated) < 60;
}

function normalizeMimeType(mime: string, imagePath: string): string {
    return (mime === "application/octet-stream" && imagePath.toLowerCase().endsWith(".heic")) ?
        "image/heic" :
        mime;
}

