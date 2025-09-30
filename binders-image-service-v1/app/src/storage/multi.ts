import {
    ImageServiceContract,
    VideoFormatType,
    VisualFormatType,
    VisualKind
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { LocalFileCopy, MediaStorage, StorageURL, VisualStorageDetails } from "./contract";
import { S3ImageStorageConfig, S3MediaStorage } from "./s3";
import { VideoStorage, VideoStorageConfig } from "./videoStorage";
import { Visual, VisualIdentifier, isVideoId, visualFormatTypeToString } from "../api/model";
import AzureBlobStorage from "./azure/AzureBlobStorage";
import { IBLOBImageStorageConfig } from "./azure/contract";
import {
    IExpressResponseOptions
} from "@binders/binders-service-common/lib/storage/object_storage";
import { LegacyVideoStorage } from "./legacyVideoStorage";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { isProduction } from "@binders/client/lib/util/environment";

export class MultiStorage implements MediaStorage {

    constructor(
        readonly logger: Logger,
        readonly imageService: ImageServiceContract,
        readonly defaultVideoStorage: MediaStorage,
        readonly legacyVideoStorage: MediaStorage,
        readonly defaultImageStorage: MediaStorage,
        readonly allBackends: MediaStorage[]
    ) {
    }

    private async getDefaultBackend(visualId: VisualIdentifier) {
        if (!isVideoId(visualId)) {
            return this.defaultImageStorage;
        }
        return this.defaultVideoStorage;
    }

    private async selectBackend(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType): Promise<MediaStorage> {
        const image = await this.imageService.getVisual(binderId, visualId.value());
        const format = image.formats.find(f => f.name === visualFormatTypeToString(formatType));
        if (format === undefined) {
            // For images, prefer to store images in the default image storage
            if (image.kind === VisualKind.IMAGE) {
                return this.defaultImageStorage;
            }
            // For videos, prefer to store videos in the same storage as the original video
            const originalFormat = image.formats.find(f => f.name === visualFormatTypeToString(VideoFormatType.ORIGINAL));
            if (originalFormat == null) {
                this.logger?.error(`No original format found for video id: ${visualId.value()}, formatType: ${formatType}`, "MultiStorage");
                return this.defaultVideoStorage;
            }
            if (VideoStorage.matchesStorageScheme(originalFormat.url)) {
                return this.legacyVideoStorage;
            }
            return this.defaultVideoStorage;
        }
        for (let i = 0; i < this.allBackends.length; i++) {
            const scheme = await this.allBackends[i].getStorageScheme(binderId, visualId, formatType);
            if (format.url.startsWith(scheme)) {
                const backendCandidate = this.allBackends[i];
                if (scheme === AzureBlobStorage.getScheme()) {
                    if (AzureBlobStorage.containerMatches(format.url, <AzureBlobStorage>backendCandidate)) {
                        return backendCandidate;
                    }
                } else {
                    return backendCandidate;
                }
            }
        }
        throw new Error(`No matching backend found for url : ${format.url}.`);
    }

    private async withBackend<T>(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType,
        f: (backend: MediaStorage) => Promise<T>): Promise<T> {
        const backend = await this.selectBackend(binderId, visualId, formatType);
        return f(backend);
    }

    async addFile(
        localPath: string,
        binderId: string,
        visualId: VisualIdentifier,
        mime: string,
        formatType: VisualFormatType,
        fileName?: string,
    ): Promise<VisualStorageDetails> {
        const backend = await this.getDefaultBackend(visualId);
        return backend.addFile(localPath, binderId, visualId, mime, formatType, fileName);
    }

    getLocalCopy(visual: Visual, formatType: VisualFormatType): Promise<LocalFileCopy> {
        const { binderId, id: visualId } = visual;
        return this.withBackend(binderId, visualId, formatType,
            b => b.getLocalCopy(visual, formatType));
    }

    getStoragePath(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, fileName?: string): Promise<string> {
        return this.withBackend(binderId, visualId, formatType,
            b => b.getStoragePath(binderId, visualId, formatType, fileName));
    }

    getStorageURL(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, fileName?: string): Promise<StorageURL> {
        return this.withBackend(binderId, visualId, formatType,
            b => b.getStorageURL(binderId, visualId, formatType, fileName));
    }

    getStorageScheme(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType): Promise<string> {
        return this.withBackend(binderId, visualId, formatType,
            b => b.getStorageScheme(binderId, visualId, formatType));
    }

    static default(
        logger: Logger,
        imageService: ImageServiceContract,
        s3Config: S3ImageStorageConfig,
        videoStorageConfig: VideoStorageConfig,
        videoLegacyStorageConfig: VideoStorageConfig,
        azureStagingConfig: IBLOBImageStorageConfig,
        azureProductionConfig: IBLOBImageStorageConfig
    ): MultiStorage {
        if (isProduction()) {
            if (! azureProductionConfig ) {
                throw new Error("Azure production config is missing!");
            }
            return MultiStorage.getProduction(logger, imageService, s3Config, videoStorageConfig, videoLegacyStorageConfig, azureProductionConfig);
        }
        return MultiStorage.getDevelopment(logger, imageService, s3Config, videoStorageConfig, videoLegacyStorageConfig, azureStagingConfig, azureProductionConfig);
    }

    private static getDevelopment(
        logger: Logger,
        imageService: ImageServiceContract,
        s3Config: S3ImageStorageConfig,
        videoStorageConfig: VideoStorageConfig,
        videoLegacyStorageConfig: VideoStorageConfig,
        azureStagingConfig: IBLOBImageStorageConfig,
        azureProductionConfig: IBLOBImageStorageConfig
    ): MultiStorage {
        const azureStaging = new AzureBlobStorage(logger, azureStagingConfig);
        const azureProduction = azureProductionConfig ?
            new AzureBlobStorage(logger, azureProductionConfig) :
            undefined;
        const s3 = new S3MediaStorage(logger, s3Config);
        const videoStorage = new VideoStorage(
            logger,
            videoStorageConfig.accountName,
            videoStorageConfig.accountKey,
        );
        const legacyVideoStorage = new LegacyVideoStorage(
            logger,
            videoLegacyStorageConfig.accountName,
            videoLegacyStorageConfig.accountKey,
        );
        const backends = [azureStaging, s3, videoStorage, legacyVideoStorage];
        if (azureProduction) {
            backends.push(azureProduction);
        }

        return new MultiStorage(
            logger,
            imageService,
            videoStorage,
            legacyVideoStorage,
            azureStaging,
            backends
        );
    }

    private static getProduction(
        logger: Logger,
        imageService: ImageServiceContract,
        s3Config: S3ImageStorageConfig,
        videoStorageConfig: VideoStorageConfig,
        videoLegacyStorageConfig: VideoStorageConfig,
        azureConfig: IBLOBImageStorageConfig
    ): MultiStorage {
        const azure = new AzureBlobStorage(logger, azureConfig);
        const s3 = new S3MediaStorage(logger, s3Config);
        const videoStorage = new VideoStorage(
            logger,
            videoStorageConfig.accountName,
            videoStorageConfig.accountKey,
        );
        const legacyVideoStorage = new LegacyVideoStorage(
            logger,
            videoLegacyStorageConfig.accountName,
            videoLegacyStorageConfig.accountKey,
        );
        return new MultiStorage(
            logger,
            imageService,
            videoStorage,
            legacyVideoStorage,
            azure,
            [azure, s3, videoStorage, legacyVideoStorage]
        );
    }

    sendFileWithExpress(
        visual: Visual,
        formatType: VisualFormatType,
        options: IExpressResponseOptions,
        response: unknown,
        next: unknown
    ): Promise<void> {
        const { binderId, id: visualId } = visual;
        return this.withBackend<void>(binderId, visualId, formatType,
            b => b.sendFileWithExpress(visual, formatType, options, response, next));
    }

    withLocalCopy<T>(visual: Visual, formatType: VisualFormatType, f: (localFile: LocalFileCopy) => Promise<T>): Promise<T> {
        const { binderId, id: visualId } = visual;
        return this.withBackend(
            binderId,
            visualId,
            formatType,
            mediaStorage => mediaStorage.withLocalCopy(visual, formatType, f)
        );
    }

    createOutputAsset(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, suffix?: string): Promise<string> {
        return this.withBackend(
            binderId,
            visualId,
            formatType,
            b => b.createOutputAsset(binderId, visualId, formatType, suffix)
        );
    }
}
