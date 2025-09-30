import { BaseMediaStorage, LocalFileCopy, StorageURL, VisualStorageDetails } from "./contract";
import {
    Video,
    Visual,
    VisualFormat,
    VisualIdentifier,
    visualFormatTypeToString
} from "../api/model";
import {
    VideoFormatType,
    VisualFormatType
} from "@binders/client/lib/clients/imageservice/v1/contract";
import AzureClient from "./azure/AzureClient";
import {
    IExpressResponseOptions
} from "@binders/binders-service-common/lib/storage/object_storage";
import { Logger } from "@binders/binders-service-common/src/util/logging";
import { Response } from "express";
import { uniq } from "ramda";
import { validateAssetId } from "@binders/client/lib/util/azureStorage";

export interface VideoStorageConfig {
    accountName: string;
    accountKey: string;
}

export class VideoStorage extends BaseMediaStorage {

    constructor(
        logger: Logger,
        private storageAccountName: string,
        private storageAccountAccessKey: string
    ) {
        super(logger);
    }

    async addFile(
        localPath: string,
        binderId: string,
        visualId: VisualIdentifier,
        mime: string,
        formatType: VisualFormatType,
        keyFrame?: string
    ): Promise<VisualStorageDetails> {
        const videoContainerName = visualId.value();
        const azureClient = new AzureClient(this.logger, this.storageAccountName, this.storageAccountAccessKey);
        await azureClient.createContainerIfMissing(videoContainerName);
        const blobName = this.getBlobName(formatType, keyFrame);
        await azureClient.createBlobFromLocalFile(videoContainerName, blobName, localPath, { contentType: mime });

        const storageUrl = await this.getStorageURL(binderId, visualId, formatType, keyFrame);
        return this.getStorageDetails(localPath, storageUrl, mime, formatType, keyFrame, videoContainerName);
    }

    getAssetIdFromStorageLocation(storageLocation: string): string {
        return storageLocation.split("/").find(part => validateAssetId(part));
    }

    async getLocalCopy(visual: Visual, formatType: VisualFormatType): Promise<LocalFileCopy> {
        const azureClient = new AzureClient(this.logger, this.storageAccountName, this.storageAccountAccessKey);
        const formatToUse = (visual.formats as VisualFormat[]).find(f => f.format === formatType);
        if (!formatToUse) {
            throw new Error(`Could not find format ${VideoFormatType[formatType]} for ${visual.id.value()}`);
        }
        const blobName = this.getBlobName(formatType);
        let localFileCopy;
        try {
            localFileCopy = await azureClient.getLocalCopy(visual.id.value(), blobName);
        } catch (e) {
            // Visuals uploaded before the bitmovin implementation are stored in a container with the assetId as name
            // To make this function - which is executed in various contexts - find these visuals,
            // a try-catch with a retry with assetId instead of visualid has been put in place
            if (e.statusCode === 404) {
                const assetIds = uniq(visual.formats.map(f => this.getAssetIdFromStorageLocation(f.storageLocation)).filter(id => !!id));
                for (const assetId of assetIds) {
                    try {
                        localFileCopy = await azureClient.getLocalCopy(assetId, blobName);
                        break;
                    } catch (e) {
                        if (e.statusCode === 404) {
                            continue;
                        }
                        throw e;
                    }
                }
            } else {
                throw e;
            }
        }
        return localFileCopy;
    }

    private getBlobName(formatType: VisualFormatType, fileName?: string): string {
        const formatName = visualFormatTypeToString(formatType);
        if (!fileName) {
            return formatName;
        }
        return `${formatName}_${fileName}`;
    }

    async getStoragePath(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, keyFrame?: string): Promise<string> {
        const containerName = visualId.value();
        const blobName = this.getBlobName(formatType, keyFrame);
        return `${containerName}/${blobName}`;
    }

    async getStorageURL(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, fileName?: string): Promise<StorageURL> {
        const scheme = await this.getStorageScheme();
        const path = await this.getStoragePath(binderId, visualId, formatType, fileName);
        return new StorageURL(scheme + path);
    }

    async getStorageScheme(): Promise<string> {
        return VideoStorage.getScheme();
    }

    static getScheme(): string {
        return "video-v2://";
    }

    static matchesStorageScheme(url: string): boolean {
        if (url == null) return false;
        return url.startsWith(VideoStorage.getScheme());
    }

    async sendFileWithExpress(
        visual: Video,
        formatType: VisualFormatType,
        options: IExpressResponseOptions,
        response: Response,
        _next: unknown
    ): Promise<void> {
        const containerName = visual.formats.find(f => f.format === formatType).container;
        const blobName = this.getBlobName(formatType);
        const azureClient = new AzureClient(this.logger, this.storageAccountName, this.storageAccountAccessKey);
        await azureClient.streamBlobToExpress(containerName, blobName, response, options);
    }

    async createOutputAsset(
        _binderId: string,
        visualId: VisualIdentifier,
        _formatType: VisualFormatType,
        _suffix?: string
    ): Promise<string> {
        return visualId.value();
    }

}
