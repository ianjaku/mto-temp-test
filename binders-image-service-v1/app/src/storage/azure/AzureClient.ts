import * as fs from "fs";
import { ICreateBlobOptions, IExpressResponseOptions } from "@binders/binders-service-common/lib/storage/object_storage";
import {
    LocalFileCopy,
    getTmpPath
} from  "../contract";
import { AzureObjectStorage } from "@binders/binders-service-common/lib/storage/azure_object_storage";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Progress } from "@binders/client/lib/util/progress";
import { Response } from "express";
import { humanizeBytes } from "@binders/client/lib/util/formatting";

export default class AzureClient {

    constructor(
        private logger: Logger,
        private account: string,
        private accessKey: string,
    ) {
    }

    private createBlobService(container: string, logger: Logger) {
        const connectionDetails = {
            account: this.account,
            accessKey: this.accessKey
        }
        return new AzureObjectStorage(
            logger,
            connectionDetails,
            container
        );
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async streamBlobToExpress(
        container: string, blob: string,
        response: Response,
        requestOptions: IExpressResponseOptions = {}
    ) {
        const objectStorage = this.createBlobService(container, this.logger);
        return objectStorage.streamToExpress(blob, response, requestOptions);
    }

    async getLocalCopy(container: string, blob: string): Promise<LocalFileCopy> {
        const localPath = getTmpPath();
        const objectStorage = this.createBlobService(container, this.logger);
        let progress = Progress.empty()
        let lastPrintProgress = 0;
        if (process.stdin.isTTY) process.stdout.write("\n");
        await objectStorage.downloadBlobToFile(blob, localPath, {
            onProgress: (downloaded, total) => {
                progress = progress.setTotal(total).setProcessed(downloaded);
                const thisPrintProgress = downloaded/total;
                if (thisPrintProgress - lastPrintProgress < (process.stdin.isTTY ? 0.01 : 0.1)) {
                    return;
                }
                if (process.stdin.isTTY) {
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0, null);
                    process.stdout.write(progress.formatDefault(humanizeBytes));
                } else {
                    this.logger.trace(
                        `Downloading container=${container} blob=${blob} Progress: ${progress.formatDefault(humanizeBytes)}`,
                        "getLocalCopy",
                    );
                }
                lastPrintProgress = thisPrintProgress;
            }
        });
        if (process.stdin.isTTY) process.stdout.write("\n");
        return {
            path: localPath,
            cleanup: () => fs.unlink(localPath, (unlinkErr) => {
                if (unlinkErr) {
                    this.logger.error(`Could not unlink local file: ${unlinkErr.message}`, "cleanup");
                }
            })
        }
    }

    async listBlobs(container: string, prefix?: string): Promise<string[]> {
        const objectStorage = this.createBlobService(container, this.logger);
        const blobs = await objectStorage.listBlobs(prefix);
        return blobs.map(b => b.name);
    }

    createBlobFromLocalFile(container: string, blob: string, localFile: string, createOptions?: ICreateBlobOptions): Promise<void> {
        const objectStorage = this.createBlobService(container, this.logger);
        return objectStorage.uploadLocalFile(blob, localFile, createOptions);
    }

    async createContainer(container: string): Promise<void> {
        const objectStorage = this.createBlobService(container, this.logger);
        await objectStorage.createContainer();
    }

    async createContainerIfMissing(container: string): Promise<void> {
        const objectStorage = this.createBlobService(container, this.logger);
        await objectStorage.createIfNotExists();
    }

    async fileExists(container: string, file: string): Promise<boolean> {
        const objectStorage = this.createBlobService(container, this.logger);
        try {
            const blobs = await objectStorage.listBlobs(file);
            return blobs.length > 0;
        } catch (e) {
            if (e.code === "ContainerNotFound" && e.statusCode === 404) {
                return false;
            }
            throw e;
        }
    }

    async containerExists(container: string): Promise<boolean> {
        const objectStorage = this.createBlobService(container, this.logger);
        try {
            await objectStorage.listBlobs();
            return true;
        } catch (e) {
            if (e.code === "ContainerNotFound" && e.statusCode === 404) {
                return false;
            }
            throw e;
        }
    }

}
