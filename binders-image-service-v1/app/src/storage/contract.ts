/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as fs from "fs";
import * as path from "path";
import {
    Visual,
    VisualFormat,
    VisualIdentifier,
    isScreenshotFormat,
    visualFormatTypeToString,
} from  "../api/model";
import {
    IExpressResponseOptions
} from "@binders/binders-service-common/lib/storage/object_storage";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Maybe } from "@binders/client/lib/monad";
import UUID from "@binders/client/lib/util/uuid";
import { VideoMetadata } from "../visualhandlers/contract";
import { VisualFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";
import { VisualHandlers } from "../api/visualhandlers";
import { tmpdir } from "os";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const md5File = require("md5-file/promise");

export const buildContentRange = (mediaTotal: number | string, mediaRange: MediaRange): string => {
    const mediaTotalNumber = (typeof mediaTotal === "string") ?
        parseInt(mediaTotal, 10) :
        mediaTotal;
    const start = mediaRange.start.isJust() ? mediaRange.start.get() : 0;
    const stop = mediaRange.stop.isJust() ? mediaRange.stop.get() : mediaTotalNumber - 1;
    mediaRange.stop = Maybe.just(stop);
    return `bytes ${start}-${stop}/${mediaTotal}`;
};

export const calculateContentLength = (totalLength: number | string, range: MediaRange): number => {
    const totalLengthNumber = (typeof totalLength === "string") ?
        parseInt(totalLength, 10) :
        totalLength;
    if (!range) {
        return totalLengthNumber;
    }
    const start = range.start.getOrElse(0);
    const stop = range.stop.getOrElse(totalLengthNumber - 1) + 1;
    return stop - start;
};

export interface VisualStorageDetails {
    md5: string;
    format: VisualFormat;
}

export class StorageURL {
    constructor(public readonly value: string) {
        if (!this.validate()) {
            throw new InvalidArgument(`Invalid storage url: ${value}`);
        }
    }

    private validate() {
        // @TODO: Add validation
        return true;
    }

    toString(): string {
        return this.value;
    }
}

export interface LocalFileCopy {
    path: string;
    cleanup: () => void;
}


export interface AzureMediaStreamingConfig {
    contentKeyPolicyName: string;
    tokenKey: string;
    tokenIssuer: string;
    tokenAudience: string;
}

export interface MediaMetadata {
    [format: string]: {
        height: number;
        width: number;
        videoMeta: VideoMetadata;
    }
}

export interface MediaRange {
    start: Maybe<number>;
    stop: Maybe<number>;
}


export interface MediaStorage {
    addFile(localPath: string, binderId: string, visualId: VisualIdentifier, mime: string, formatType: VisualFormatType, fileName?: string): Promise<VisualStorageDetails>;
    getLocalCopy(visual: Visual, formatType: VisualFormatType): Promise<LocalFileCopy>;
    getStoragePath(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, fileName?: string): Promise<string>;
    getStorageURL(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, fileName?: string): Promise<StorageURL>;
    getStorageScheme(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType): Promise<string>;
    sendFileWithExpress(visual: Visual, formatType: VisualFormatType, options: IExpressResponseOptions, response, next): Promise<void>;
    withLocalCopy<T>(visual: Visual, formatType: VisualFormatType, f: (localFile: LocalFileCopy) => Promise<T>): Promise<T>;
    createOutputAsset(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, suffix?: string): Promise<string>;
}

export abstract class BaseMediaStorage implements MediaStorage {
    constructor(protected readonly logger: Logger) {

    }

    async getStorageDetails(
        localPath: string,
        storageLocation: StorageURL,
        mime: string,
        format: VisualFormatType,
        _keyFrame: string,
        container: string,
    ): Promise<VisualStorageDetails> {
        const logger = this.logger;
        const md5 = await md5File(localPath)
        const mimeToUse = isScreenshotFormat(format) ? "image/png" : mime;
        const handler = VisualHandlers.get(mimeToUse, logger);
        const metadata = await handler.getMetadata(localPath)
        const fileStats = fs.statSync(localPath);
        const baseFormat: VisualFormat = {
            container,
            format,
            height: metadata.height,
            size: fileStats["size"],
            storageLocation: storageLocation.toString(),
            width: metadata.width,
        };
        let extraProps = {};

        // eslint-disable-next-line no-prototype-builtins
        if (metadata.hasOwnProperty("videoCodec")) {
            const videoMeta = metadata as VideoMetadata;
            extraProps = {
                videoCodec: videoMeta.videoCodec,
                audioCodec: videoMeta.audioCodec,
                durationInMs: videoMeta.durationInMs,
                hasAudio: metadata.hasAudio
            };
        }
        const visualFormat = Object.assign(baseFormat, extraProps);
        return { md5, format: visualFormat };
    }

    duplicateVisual(visual: Visual, formatType: VisualFormatType): Promise<VisualStorageDetails> {
        const { binderId, id: visualId, mime } = visual;
        return this.withLocalCopy(visual, formatType, localFile => this.addFile(localFile.path, binderId, visualId, mime, formatType));
    }

    abstract addFile(localPath: string, binderId: string, visualId: VisualIdentifier, mime: string, formatType: VisualFormatType, fileName?: string): Promise<VisualStorageDetails>;
    abstract getLocalCopy(visual: Visual, formatType: VisualFormatType): Promise<LocalFileCopy>;
    abstract getStoragePath(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, fileName?: string): Promise<string>;
    abstract getStorageURL(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, fileName?: string): Promise<StorageURL>;
    abstract getStorageScheme(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType): Promise<string>;
    abstract sendFileWithExpress(visual: Visual, formatType: VisualFormatType, options: IExpressResponseOptions, response, next): Promise<void>;
    abstract createOutputAsset(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, suffix?: string): Promise<string>;

    async withLocalCopy<T>(visual: Visual, formatType: VisualFormatType, f: (copy: LocalFileCopy) => Promise<T>): Promise<T> {
        const localCopy = await this.getLocalCopy(visual, formatType);
        try {
            return await f(localCopy);
        } finally {
            localCopy.cleanup();
        }
    }
}

export abstract class MediaStorageOverHTTP extends BaseMediaStorage {

    async addFile(localPath: string, binderId: string, visualId: VisualIdentifier, mime: string, formatType: VisualFormatType, fileName: string): Promise<VisualStorageDetails> {
        const storageURL = await this.getStorageURL(binderId, visualId, formatType, fileName);
        const storageDetails = await this.getStorageDetails(localPath, storageURL, mime, formatType, undefined, undefined);
        await this.uploadFile(localPath, binderId, visualId, formatType, mime);
        return storageDetails;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createOutputAsset(binderId, visualId, formatType, suffix): Promise<string> {
        throw new Error("Not implemented");
    }

    protected abstract uploadFile(localPath: string, binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType, mime: string): Promise<void>;

    static getVisualContainerKey(binderId: string, visualId: VisualIdentifier): string {
        return [
            binderId.substr(0, 4),
            binderId.substr(4, 4),
            binderId.substr(8),
            visualId.value()
        ].join("/");
    }

    static getVisualKey(
        binderId: string,
        visualId: VisualIdentifier,
        formatType: VisualFormatType,
        fileName?: string,
    ): string {
        return [
            binderId.substr(0, 4),
            binderId.substr(4, 4),
            binderId.substr(8),
            visualId.value(),
            fileName,
            visualFormatTypeToString(formatType)
        ].filter(part => part !== undefined).join("/");
    }
}

export const getTmpPath = () => path.join(tmpdir(), UUID.random().toString());

