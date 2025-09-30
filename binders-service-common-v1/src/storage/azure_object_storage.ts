import * as HTTPStatusCode from "http-status-codes";
import {
    AnonymousCredential,
    BlobDownloadOptions,
    BlobGetPropertiesResponse,
    BlobItem as BlobItemAzure,
    BlobServiceClient,
    BlockBlobClient,
    StorageSharedKeyCredential,
    newPipeline
} from "@azure/storage-blob";
import {
    ICreateBlobOptions,
    IExpressResponseOptions,
    IObjectStorage,
    MediaRange
} from "./object_storage";
import { Config } from "@binders/client/lib/config";
import { Logger } from "../util/logging";
import { Maybe } from "@binders/client/lib/monad";
import { Readable } from "stream";
import { Response } from "express";
import { isStreamWritable } from "../util/stream";

export interface IBlobStreamOptions {
    start?: number;
    end?: number;
}

export type BlobItem = BlobItemAzure;

export interface ConnectionDetailsWithSharedKey {
    account: string;
    accessKey: string;
}

export interface ConnectionDetailsWithSAS {
    host: string;
    sasToken: string;
}

export interface IAzureBlobConfig extends ConnectionDetailsWithSharedKey {
    container: string;
}

function isSasConnectionDetails(details: ConnectionDetails): details is ConnectionDetailsWithSAS {
    return (details as ConnectionDetailsWithSAS).sasToken !== undefined;
}

export type ConnectionDetails = ConnectionDetailsWithSharedKey | ConnectionDetailsWithSAS;

export interface DownloadOptions {
    onProgress: (bytesDownloaded: number, bytesTotal: number) => void;
}

export class AzureObjectStorage implements IObjectStorage {

    constructor(
        private logger: Logger,
        private connectionDetails: ConnectionDetails,
        private container: string
    ) {

    }

    async downloadBlobToFile(blobName: string, localFile: string, options: Partial<DownloadOptions> = {}): Promise<void> {
        let totalBytes: number;
        let onProgress: BlobDownloadOptions["onProgress"];
        if (options.onProgress) {
            const blockProps = await this.getBlobProperties(blobName);
            totalBytes = blockProps.contentLength;
            onProgress = (evt) => options.onProgress(evt.loadedBytes, totalBytes);
        }
        const blockBlobClient = this.createBlockBlobClient(blobName);
        await blockBlobClient.downloadToFile(localFile, undefined, undefined, { onProgress })
    }

    private getUploadOptions(contentType?: string) {
        const options = {
            blockSize: 16 * 1024 * 1024, // 16MB block size
            concurrency: 10
        }
        if (contentType) {
            options["blobHTTPHeaders"] = {
                blobContentType: contentType
            }
        }
        return options;
    }

    async uploadBlobFromStream(blobName: string, stream: Readable, contentType?: string): Promise<void> {
        this.logger.info(
            `Starting upload of stream to ${this.container}:${blobName}`,
            "azure-blob-upload"
        );
        try {
            const blockBlobClient = this.createBlockBlobClient(blobName);
            const options = this.getUploadOptions(contentType);
            await blockBlobClient.uploadStream(
                stream,
                options.blockSize,
                options.concurrency,
                { blobHTTPHeaders: options["blobHTTPHeaders"] }
            );
            this.logger.debug(
                `Successfully uploaded item ${blobName} to BLOB-storage`,
                "azure-blob-upload"
            );
        } catch (err) {
            this.logger.error(
                `Upload of ${blobName} to BLOB-storage failed: ${err.message}`,
                "azure-blob-upload"
            );
            throw err;
        }
    }

    async uploadLocalFile(
        blobName: string,
        localFile: string,
        options: ICreateBlobOptions = {}
    ): Promise<void> {
        this.logger.info(
            `Starting upload of ${localFile} to ${this.container}:${blobName}`,
            "azure-blob-upload"
        );

        try {
            const blockBlobClient = this.createBlockBlobClient(blobName);
            await blockBlobClient.uploadFile(
                localFile,
                this.getUploadOptions(options.contentType)
            );
            this.logger.debug(
                `Successfully uploaded item ${localFile} to BLOB-storage`,
                "azure-blob-upload"
            );
        } catch (err) {
            this.logger.error(
                `Upload of ${localFile} to BLOB-storage failed: ${err.message}`,
                "azure-blob-upload"
            );
            throw err;
        }
    }


    private getContentType(blobProps: BlobGetPropertiesResponse, mime?: string): string {
        const contentType = mime || (blobProps?.contentType);
        // in image context, we consider xml as svg
        return contentType === "application/xml" ? "image/svg+xml" : contentType;
    }

    async streamToExpress(
        blobName: string,
        response: Response,
        options: IExpressResponseOptions = {}
    ): Promise<void> {
        try {
            const { logger } = this;
            const blobProps = await this.getBlobProperties(blobName);
            if (options.requiredETag && options.requiredETag !== blobProps.etag) {
                response.status(HTTPStatusCode.REQUESTED_RANGE_NOT_SATISFIABLE);
                response.end();
                return undefined;
            }
            const mediaTotal = blobProps.contentLength;
            response.set("Cache-Control", "max-age=360000");
            if (options.range) {
                response.status(HTTPStatusCode.PARTIAL_CONTENT);
                response.set("Accept-Ranges", "bytes");
                response.set("Content-Range", this.buildContentRange(mediaTotal, options.range));
            }
            const contentLength = this.calculateContentLength(mediaTotal, options.range);
            const mimeToUse = this.getContentType(blobProps, options.mime);
            if (mimeToUse) {
                response.set("Content-Type", mimeToUse);
            }
            response.set("Content-Length", contentLength.toString());
            response.set("Last-Modified", blobProps.lastModified.toString());
            response.set("ETag", blobProps.etag);

            try {
                const range = {
                    start: options?.range?.start?.getOrElse(0),
                    end: options?.range?.stop?.getOrElse(mediaTotal - 1)
                }
                await this.streamBlobFromAzure(
                    blobName,
                    response,
                    range
                );
                logger.debug(
                    `Successfully sent file ${this.container}/${blobName}`,
                    "azure-blob-stream"
                );
            } catch (err) {
                logger.error(
                    `Error streaming blob from azure (${this.container}/${blobName}): ${err.message}`,
                    "azure-blob-stream"
                );
                throw err;
            }
        } catch (error) {
            this.logger.error(
                "Could not stream blob",
                "azure-blob-stream",
                { container: this.container, blobName, error }
            );
            if (isStreamWritable(response, this.logger, "azure-blob-stream")) {
                if (error.code === "NotFound") {
                    response.status(HTTPStatusCode.NOT_FOUND);
                } else {
                    response.status(HTTPStatusCode.INTERNAL_SERVER_ERROR);
                }
            }
            response.end();
        }
    }

    private buildContentRange(
        mediaTotal: number | string,
        mediaRange: MediaRange
    ): string {
        const mediaTotalNumber = (typeof mediaTotal === "string") ?
            parseInt(mediaTotal, 10) :
            mediaTotal;
        const start = mediaRange.start.isJust() ? mediaRange.start.get() : 0;
        const stop = mediaRange.stop.isJust() ? mediaRange.stop.get() : mediaTotalNumber - 1;
        mediaRange.stop = Maybe.just(stop);
        return `bytes ${start}-${stop}/${mediaTotal}`;
    }

    private async streamBlobFromAzure(
        blobName: string,
        response: Response,
        options: IBlobStreamOptions
    ): Promise<Response | void> {
        const { logger } = this;
        if (options) {
            const { start, end } = options;
            const blockBlobClient = this.createBlockBlobClient(blobName);
            const downloadResponse = await blockBlobClient.download(start, end + 1);
            const readStream = downloadResponse.readableStreamBody;
            readStream.on("error", (error) => {
                logger.error(
                    `Error reading from blob stream ${error.message || error}`,
                    "blob-stream"
                );
                response.end();
            });
            return readStream.pipe(response);
        }
    }

    getBlobProperties(blob: string): Promise<BlobGetPropertiesResponse> {
        const blockBlobClient = this.createBlockBlobClient(blob);
        return blockBlobClient.getProperties();
    }

    private calculateContentLength(
        totalLength: number | string,
        range: MediaRange
    ): number {
        const totalLengthNumber = (typeof totalLength === "string") ?
            parseInt(totalLength, 10) :
            totalLength;
        if (!range) {
            return totalLengthNumber;
        }
        const start = range.start.getOrElse(0);
        const stop = range.stop.getOrElse(totalLengthNumber - 1) + 1;
        return stop - start;
    }

    private createContainerClient() {
        let credential: StorageSharedKeyCredential | AnonymousCredential;
        let url: string;
        if (isSasConnectionDetails(this.connectionDetails)) {
            credential = new AnonymousCredential();
            const { host, sasToken } = this.connectionDetails;
            url = `https://${host}?${sasToken}`;
        } else {
            const { account, accessKey } = this.connectionDetails;
            credential = new StorageSharedKeyCredential(account, accessKey);
            url = `https://${account}.blob.core.windows.net`;
        }
        const pipeline = newPipeline(
            credential,
            { retryOptions: { maxTries: 10 } }
        );
        const blobServiceClient = new BlobServiceClient(
            url,
            pipeline
        );
        return blobServiceClient.getContainerClient(this.container);
    }

    private createBlockBlobClient(blobName: string): BlockBlobClient {
        const containerClient = this.createContainerClient();
        return containerClient.getBlockBlobClient(blobName);
    }

    async listBlobs(prefix?: string): Promise<BlobItem[]> {
        const containerClient = this.createContainerClient();
        const options = prefix ? { prefix } : {};
        const items = [];
        for await (const blob of containerClient.listBlobsFlat(options)) {
            items.push(blob);
        }
        return items;
    }

    /**
     * Creates a new container only if it does not exist, otherwise it fails
     * Use {@link createIfNotExists} to ensure the container is created
     */
    async createContainer(): Promise<void> {
        const containerClient = this.createContainerClient();
        await containerClient.create();
    }

    /** Ensures the container exists by creating it if missing */
    async createIfNotExists(): Promise<void> {
        const containerClient = this.createContainerClient();
        await containerClient.createIfNotExists();
    }

    async deleteBlob(blobName: string): Promise<void> {
        const containerClient = this.createContainerClient();
        await containerClient.deleteBlob(blobName);
    }
}

export function getBlobConfig(config: Config, configName: string, logger?: Logger): IAzureBlobConfig {
    const rootKey = `azure.blobs.${configName}`;
    const packedConfig = {
        accessKey: config.getString(`${rootKey}.accessKey`),
        account: config.getString(`${rootKey}.account`),
        container: config.getString(`${rootKey}.container`)
    };
    const errorMessage = `Missing config for ${rootKey}`;
    return Maybe.unpack(packedConfig)
        .caseOf({
            left: error => {
                logger?.error(errorMessage, "get-blob-config");
                throw error;
            },
            right: v => v
        });
}
