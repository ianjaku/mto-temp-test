import AzureClient from "./AzureClient";
import { IBLOBImageStorageConfig } from "./contract";
import { ItemStorage } from "../itemStorage";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Response } from "express";
import { detectMimeFromFilePath } from "../../helper/mime";

export class AzureItemStorage implements ItemStorage {
    private azureClient: AzureClient;

    constructor(
        private readonly folder: string,
        private readonly logger: Logger,
        private readonly config: IBLOBImageStorageConfig,
    ) {
        this.azureClient = new AzureClient(logger, config.account, config.accessKey);
    }

    private getBlob(suffix: string) {
        return `${this.folder}/${suffix}`;
    }

    async addItem(fileName: string, localFile: string): Promise<void> {
        const blob = this.getBlob(fileName);
        const mimeOption = await detectMimeFromFilePath(localFile);
        const createOptions = mimeOption.isJust() ?
            { contentType: mimeOption.get() } :
            {};
        await this.azureClient.createBlobFromLocalFile(this.config.container, blob, localFile, createOptions);
    }

    async sendFileWithExpress(fileName: string, response: Response): Promise<void> {
        const blob = this.getBlob(fileName);
        await this.azureClient.streamBlobToExpress(this.config.container, blob, response);
    }
}