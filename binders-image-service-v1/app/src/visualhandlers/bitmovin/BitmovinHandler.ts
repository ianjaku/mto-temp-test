import {
    ContainerSASPermissions,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters
} from "@azure/storage-blob";
import {
    Format,
    IVideoIndexerResult,
    VideoFormat,
    VideoFormatType
} from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    NotificationServiceContract,
    RoutingKeyType,
    ServiceNotificationType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    TranscodeResult,
    TranscodeStepDetailsUpdateFn,
    VisualHandler,
    VisualMetadata
} from "../contract";
import { Video, Visual } from "../../api/model";
import { startBitmovinEncoding, waitForBitmovinEncodingToFinish } from "./bitmovin";
import AzureClient from "../../storage/azure/AzureClient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { IVideoIndexerRepository } from "../../api/videoIndexerRepository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Thumbnail } from "@bitmovin/api-sdk";
import { add } from "date-fns";
import { getVideoMetadata } from "../../metadata";

export class BitmovinHandler extends VisualHandler {

    private readonly storageAccountName: string;
    private readonly storageAccountKey: string;
    private readonly logger: Logger;
    private readonly config: BindersConfig;

    constructor(
        config: BindersConfig,
        logger: Logger,
    ) {
        super();
        this.config = config;
        this.storageAccountName = this.config.getString("azure.blobs.videos-v2.account").get();
        this.storageAccountKey = this.config.getString("azure.blobs.videos-v2.accessKey").get();
        this.logger = logger;
    }

    getMetadata(filePath: string): Promise<VisualMetadata> {
        return getVideoMetadata(filePath);
    }

    resize(_path: unknown, _metadata: unknown, _format: unknown): Promise<string> {
        throw new Error("Method not implemented. resize()");
    }

    private bitmovinThumbnailsToFormat(visual: Video, thumbnails: Thumbnail[]): Format[] {
        return thumbnails.flatMap<Format>(thumbnail => {
            return thumbnail.positions.map(position => ({
                name: VideoFormatType[VideoFormatType.VIDEO_SCREENSHOT],
                height: thumbnail.height,
                width: this.getScaledWidth(visual as Video, thumbnail.height),
                size: 0,
                container: visual.id.value(),
                url: `video-v2://${visual.id.value()}/${thumbnail.pattern.replace("%number%", position.toFixed(1).replace(".", "_"))}`,
                keyFramePosition: position
            }))
        });
    }

    async transcode(visual: Visual, transcodeStateUpdateFn?: TranscodeStepDetailsUpdateFn): Promise<TranscodeResult> {
        const visualId = visual.id.value();

        const { manifestPaths, encodingId, thumbnails } = await startBitmovinEncoding(
            this.config,
            visual as Video,
            {
                accountName: this.storageAccountName,
                accountKey: this.storageAccountKey,
                container: visualId,
            },
            {
                hasAudio: !!visual.hasAudio
            },
            this.logger,
        );
        const thumbnailFormats = this.bitmovinThumbnailsToFormat(visual as Video, thumbnails);
        return this.waitToCompleteTranscode(visual, encodingId, manifestPaths, thumbnailFormats, transcodeStateUpdateFn);
    }

    async waitToCompleteTranscode(
        visual: Visual,
        encodingId: string,
        manifestPaths: string[],
        thumbnailFormats: Format[],
        transcodeStepDetailsUpdateFn: TranscodeStepDetailsUpdateFn | undefined,
    ): Promise<TranscodeResult> {
        const rewriteTranscodeStateDetailsFn = () => transcodeStepDetailsUpdateFn?.({
            encodingId,
            manifestPaths,
            thumbnailFormats,
        });
        await waitForBitmovinEncodingToFinish(this.config, encodingId, rewriteTranscodeStateDetailsFn, this.logger);

        const mp4Formats = await this.getMp4Formats(visual as Video);
        return {
            streamingInfo: {
                manifestPaths,
                streamingHostname: `${this.storageAccountName}.blob.core.windows.net`,
                contentKeyId: visual.id.value(),
            },
            formats: [...thumbnailFormats, ...mp4Formats]
        };
    }

    private async getMp4Formats(visual: Video): Promise<VideoFormat[]> {
        const visualId = visual.id.value();
        const storage = new AzureClient(this.logger, this.storageAccountName, this.storageAccountKey);
        const blobNames = await storage.listBlobs(visualId, "streams/video/mp4");

        return blobNames.map<VideoFormat>(blobName => {
            const match = blobName.match(/([0-9]+)x([0-9]+)_([0-9])/i);
            if (match == null || match.length !== 4) {
                this.logger.error(`Could not parse mp4 format from ${blobName}`, "bitmovin");
                return null;
            }
            const [_, widthStr, heightStr, _bitrate] = match;

            const width = parseInt(widthStr);
            const height = parseInt(heightStr);
            if (isNaN(width) || isNaN(height)) {
                this.logger.error(`Could not parse mp4 format from ${blobName}`, "bitmovin");
                return null;
            }

            return {
                name: VideoFormatType[this.getVideoFormat(height)],
                width: width,
                height: height,
                size: 0,
                // The blob name includes the full path from the root of the container
                url: `video-v2://${visualId}/${blobName}`,
                container: visualId,
                audioCodec: visual.hasAudio ? "aac" : undefined,
                videoCodec: "h264",
            }
        }).filter(format => format != null);
    }

    private getVideoFormat(height: number): VideoFormatType {
        if (height > 720) return VideoFormatType.VIDEO_DEFAULT_HD;
        if (height > 480) return VideoFormatType.VIDEO_DEFAULT_SD;
        return VideoFormatType.VIDEO_DEFAULT_LD;
    }

    private getScaledWidth(visual: Video, height: number): number {
        const original = visual.formats.find(f => f.format === VideoFormatType.ORIGINAL);
        if (original == null) {
            throw new Error(`Could not find original format for ${visual.id.value()}`);
        }
        return Math.floor((original.width / original.height) * height);
    }

    async transformOriginal(
        originalImagePath: string,
        _originalImageMetadata: unknown,
    ): Promise<string> {
        return originalImagePath;
    }

    private async onVideoIndexerResultUpdate(
        videoIndexerResult: IVideoIndexerResult,
        notificationServiceClient: NotificationServiceContract,
        videoIndexerRepository: IVideoIndexerRepository
    ): Promise<void> {
        await videoIndexerRepository.saveVideoIndexerResult(videoIndexerResult);
        notificationServiceClient.dispatch(
            {
                type: RoutingKeyType.ACCOUNT,
                value: videoIndexerResult.accountId,
            },
            ServiceNotificationType.VIDEOINDEXING_PROGRESS,
            videoIndexerResult,
        );
    }

    createAccessToken(visualId: string): string {
        const sharedKeyCredential = new StorageSharedKeyCredential(
            this.storageAccountName,
            this.storageAccountKey,
        );
        const queryParams = generateBlobSASQueryParameters({
            containerName: visualId,
            permissions: ContainerSASPermissions.parse("r"),
            expiresOn: add(new Date(), { days: 1 }),
        }, sharedKeyCredential);
        return queryParams.toString();
    }
}
