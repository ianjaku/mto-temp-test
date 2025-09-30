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

const imageFormats = [
    VideoFormatType.VIDEO_SCREENSHOT,
    VideoFormatType.VIDEO_SCREENSHOT_BIG,
    VideoFormatType.VIDEO_SCREENSHOT_BIG_2,
    VideoFormatType.VIDEO_SCREENSHOT_HUGE,
    VideoFormatType.VIDEO_SCREENSHOT_MEDIUM
];

enum FormatToBitRate {
    ORIGINAL = 0,
    VIDEO_DEFAULT_HD = 5010,
    VIDEO_DEFAULT_SD = 1200,
    VIDEO_DEFAULT_LD = 350,
    VIDEO_IPHONE_HD = 5000,
}

function getBitRateFromFormat(format) {
    switch (format) {
        case VideoFormatType.VIDEO_IPHONE_HD: {
            return FormatToBitRate.VIDEO_IPHONE_HD
        }
        case VideoFormatType.VIDEO_DEFAULT_HD: {
            return FormatToBitRate.VIDEO_DEFAULT_HD
        }
        case VideoFormatType.VIDEO_DEFAULT_SD: {
            return FormatToBitRate.VIDEO_DEFAULT_SD
        }
        case VideoFormatType.VIDEO_DEFAULT_LD: {
            return FormatToBitRate.VIDEO_DEFAULT_LD
        }
        default: {
            return ""
        }
    }
}

function getStorageBlobName(formatType, keyFrame?: string) {
    if (imageFormats.indexOf(formatType) > -1) {
        // thumbnails created locally
        if (!keyFrame) {
            return visualFormatTypeToString(formatType);
        }
        // thumbnails created by transform
        return `THUMBNAIL_00000${keyFrame}${visualFormatTypeToString(formatType)}`;
    }
    // original and transcoded clips
    return `${visualFormatTypeToString(formatType)}${getBitRateFromFormat(formatType)}${formatType === VideoFormatType.ORIGINAL ? "" : ".mp4"}`;
}

export class LegacyVideoStorage extends BaseMediaStorage {

    constructor(
        logger: Logger,
        private storageAccountName: string,
        private storageAccountAccessKey: string
    ) {
        super(logger);
    }

    async addFile(
        _localPath: string,
        _binderId: string,
        _visualId: VisualIdentifier,
        _mime: string,
        _formatType: VisualFormatType,
        _keyFrame?: string
    ): Promise<VisualStorageDetails> {
        throw new Error("Method not implemented.");
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
        return LegacyVideoStorage.getScheme();
    }

    static getScheme(): string {
        return "azurems://";
    }

    static matchesStorageScheme(url: string): boolean {
        if (url == null) return false;
        return url.startsWith(LegacyVideoStorage.getScheme());
    }

    async sendFileWithExpress(
        visual: Video,
        formatType: VisualFormatType,
        options: IExpressResponseOptions,
        response: Response,
        _next: unknown
    ): Promise<void> {
        let keyFrame;
        if (options.fileName) {
            keyFrame = options.fileName[options.fileName.length - 1];
        }
        options.sas = true;
        const format = (visual.formats as VisualFormat[]).find(f => f.format === formatType);
        const blobName = getStorageBlobName(formatType, keyFrame);
        const containerName = format.container;
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
