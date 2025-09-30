/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as HTTPStatusCode from "http-status-codes";
import * as fs from "fs";
import { Either, Maybe } from "@binders/client/lib/monad";
import {
    ImageFormatType,
    VideoFormatType,
    VisualFormatType
} from  "@binders/client/lib/clients/imageservice/v1/contract";
import {
    LocalFileCopy,
    MediaStorageOverHTTP,
    StorageURL,
    VisualStorageDetails,
    buildContentRange,
    calculateContentLength,
    getTmpPath
} from  "./contract";
import {
    Visual,
    VisualFormat,
    VisualIdentifier,
    isVideoId,
    visualFormatTypeToString
} from  "../api/model";
import { Config } from "@binders/client/lib/config/config";
import {
    IExpressResponseOptions
} from  "@binders/binders-service-common/lib/storage/object_storage";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require("aws-sdk");

export interface S3ImageStorageConfig {
    accessKey: string;
    secret: string;
    region: string;
    transcoderRegion: string;
    maxRetries: number;
    bucket: string;
}

export function buildS3Config(config: Config, rootKey: string): Either<Error, S3ImageStorageConfig> {
    const packedConfig = {
        accessKey: config.getString(`${rootKey}.accessKey`),
        secret: config.getString(`${rootKey}.secret`),
        region: config.getString(`${rootKey}.region`),
        transcoderRegion: config.getString(`${rootKey}.transcoderRegion`),
        bucket: config.getString(`${rootKey}.bucket`),
        maxRetries: config.getNumber(`${rootKey}.maxRetries`)
    };
    return Maybe.unpack(packedConfig);
}

export class S3MediaStorage extends MediaStorageOverHTTP {

    private client;
    private bucket: string;

    async addFile(
        localPath: string,
        binderId: string,
        visualId: VisualIdentifier,
        mime: string,
        formatType: VisualFormatType,
        fileName: string,
    ): Promise<VisualStorageDetails> {
        const pathParts = this.getStoragePathParts(binderId, visualId, formatType, fileName);
        const stream = fs.createReadStream(localPath);
        const uploadDetails = {
            queueSize: 10,
            params: {Bucket: pathParts.bucket, Key: pathParts.key, Body: stream},
            service: this.client
        };
        const storageURL = await this.getStorageURL(binderId, visualId, formatType, fileName);
        const storageDetails = await this.getStorageDetails(localPath, storageURL, mime, formatType, undefined, undefined);
        await this.uploadFile(storageURL, uploadDetails);
        return storageDetails;
    }

    private buildGetParams(
        binderId: string,
        visualId: VisualIdentifier,
        formatType: VisualFormatType,
        options?: IExpressResponseOptions,
        fileName?: string,
    ) {
        const pathParts = this.getStoragePathParts(binderId, visualId, formatType, fileName);
        const params = {
            Bucket: pathParts.bucket,
            Key: pathParts.key
        };
        if (options) {
            if (options.range) {
                params["Range"] = "bytes=" +
                    ( (options.range.start && options.range.start.isJust()) ? options.range.start.get() : "") +
                    "-" +
                    ( (options.range.stop && options.range.stop.isJust()) ? options.range.stop.get() : "");
            }
        }
        return params;
    }

    constructor(logger: Logger, private s3Config: S3ImageStorageConfig) {
        super(logger);
        this.createClient();
        this.bucket = s3Config.bucket;
    }

    private createClient() {
        this.client = new AWS.S3({
            accessKeyId: this.s3Config.accessKey,
            secretAccessKey: this.s3Config.secret,
            signatureVersion: "v4"
        });
    }

    private extractStoragePropertiesFromVisual(visual: Visual, formatType: VisualFormatType, fileName?: string): string {
        let formatSuffix = visualFormatTypeToString(formatType);
        if (fileName) {
            formatSuffix = `${fileName}/${formatSuffix}`;
        }
        const findFormat: (format: VisualFormat) => boolean = (f: VisualFormat) => f.storageLocation.endsWith(formatSuffix);
        const format: VisualFormat = (visual.formats as VisualFormat[]).find(findFormat);
        const bucket = `${this.bucket}/`;
        const bucketIndex = format.storageLocation.indexOf(bucket);
        return format.storageLocation.substring(bucketIndex + bucket.length);
    }

    getLocalCopy(visual: Visual, formatType: VisualFormatType): Promise<LocalFileCopy> {
        const { binderId, id: visualId } = visual;
        const localPath = getTmpPath();
        const targetStream = fs.createWriteStream(localPath);
        const client = this.client;
        const logger = this.logger;
        const s3GetParams = this.buildGetParams(binderId, visualId, formatType);
        return new Promise( (resolve, reject) => {
            const stream = client.getObject(s3GetParams).createReadStream();
            stream.on("error", (error) => reject(error));
            targetStream.on("error", (error) => reject(error));
            targetStream.on("close", () => resolve({
                path: localPath,
                cleanup: () => fs.unlink(localPath, (err) => {
                    if (err) {
                        logger.error(`Could not unlink local file: ${err.message}`, "cleanup");
                    }
                })
            }));
            stream.pipe(targetStream);
        });
    }

    async getStoragePath(
        binderId: string,
        visualId: VisualIdentifier,
        formatType: VisualFormatType,
        fileName?: string,
    ): Promise<string> {
        const pathParts = this.getStoragePathParts(binderId, visualId, formatType, fileName);
        return `${pathParts.bucket}/${pathParts.key}`;
    }

    private getStoragePathParts(
        binderId: string,
        visualId: VisualIdentifier,
        formatType: VisualFormatType,
        fileName: string,
    ) {
        return {
            bucket: this.bucket,
            key: MediaStorageOverHTTP.getVisualKey(binderId, visualId, formatType, fileName)
        };
    }

    async getStorageURL(
        binderId: string,
        visualId: VisualIdentifier,
        formatType: VisualFormatType,
        fileName?: string,
    ): Promise<StorageURL> {
        const scheme = await this.getStorageScheme();
        const path = await this.getStoragePath(binderId, visualId, formatType, fileName);
        return new StorageURL( scheme + path );
    }

    async getStorageScheme(): Promise<string> {
        return S3MediaStorage.getScheme();
    }

    static getScheme(): string {
        return "s3://";
    }

    sendFileWithExpress(
        visual: Visual,
        formatType: VisualFormatType,
        options: IExpressResponseOptions,
        response,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        next
    ): Promise<void> {
        const logger = this.logger;
        const client = this.client;
        const getParams = this.buildGetParams.bind(this);
        const recreateClient = this.createClient.bind(this);
        const { binderId, id: visualId } = visual;
        const s3GetParams: { Bucket: string; Key: string } = {
            Bucket: this.bucket,
            Key: this.extractStoragePropertiesFromVisual(visual, formatType, options.fileName),
        };
        return new Promise<void>( (resolve, reject) => {
            client.headObject(s3GetParams, function (error, data) {
                if (error) {
                    logger.error(`Could not get head for object '${s3GetParams.Bucket}/${s3GetParams.Key}': ${error.toString()}`, "visual-download");
                    recreateClient();
                    return reject(error);
                }
                if (options.requiredETag && options.requiredETag !== data.ETag) {
                    response.status(HTTPStatusCode.REQUESTED_RANGE_NOT_SATISFIABLE);
                    response.end();
                    resolve(undefined);
                    return;
                }
                const mediaTotal = data.ContentLength;
                response.set("Cache-Control", "max-age=360000");
                if (options.range) {
                    response.status(HTTPStatusCode.PARTIAL_CONTENT);
                    response.set("Accept-Ranges", "bytes");
                    response.set("Content-Range", buildContentRange(mediaTotal, options.range));
                }
                const contentLength = calculateContentLength(mediaTotal, options.range);
                response.set("Content-Type", options.mime);
                response.set("Content-Length", contentLength);
                response.set("Last-Modified", data.LastModified);
                response.set("ETag", data.ETag);
                const s3GetParamsWithRanges = getParams(binderId, visualId, formatType, options);
                s3GetParamsWithRanges.Key = s3GetParams.Key;
                const stream = client.getObject(s3GetParamsWithRanges).createReadStream();
                let waiting = true;
                stream.on("error", function (err) {
                    logger.error(`Error while sending file: ${err.message}`, "visual-download");
                    reject(err);
                });
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const latencyKeys = ["s3", "latency"];
                stream.on("data", function() {
                    if (waiting) {
                        waiting = false;
                    }
                });
                stream.on("end", () => {
                    logger.debug(`Successfully sent file ${binderId}/${visualId.value()} ${visualFormatTypeToString(formatType)}`, "visual-download");
                    resolve(undefined);
                });
                logger.debug(`Streaming object '${s3GetParams.Bucket}/${s3GetParams.Key}'`, "visual-download");
                stream.pipe(response);
            });
        });
    }

    protected uploadFile(storageURL, uploadDetails): Promise<void> {
        const logger = this.logger;
        return new Promise<void>( (resolve, reject) => {
            logger.debug(`Starting upload of ${storageURL} to S3`, "s3-upload");
            new AWS.S3.ManagedUpload(uploadDetails)
                .promise()
                .then(
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    success => {
                        logger.debug(`Successfully uploaded item ${storageURL} to S3`, "s3-upload");
                        resolve(undefined);
                    },
                    error => {
                        logger.error(`Upload of ${storageURL} to S3 failed: ${error.message}`, "s3-upload");
                        reject(error);
                    }
                );
        });
    }

    listStoredFormats(binderId: string, visualId: VisualIdentifier): Promise<VisualFormatType[]> {
        const containerKey = MediaStorageOverHTTP.getVisualContainerKey(binderId, visualId);
        const params = {
            Bucket: this.bucket,
            Prefix: containerKey
        };
        return new Promise( (resolve, reject) => {
            this.client.listObjects(params, (error, data) => {
                if (error) {
                    return reject(error);
                }
                try {
                    const formats = data.Contents.map(object => {
                        const key = object.Key;
                        const formatAsString = key.split("/").pop();
                        if (isVideoId(visualId)) {
                            return VideoFormatType[formatAsString];
                        }
                        return ImageFormatType[formatAsString];
                    });
                    resolve(formats);
                } catch (err) {
                    reject(err);
                }
            });
        });
    }
}