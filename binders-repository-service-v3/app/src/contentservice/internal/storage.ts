import { AzureObjectStorage, IAzureBlobConfig } from "@binders/binders-service-common/lib/storage/azure_object_storage";
import { LlmFile } from "./llm";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export interface ILlmStorage {
    addFile(localPath: string, file: LlmFile): Promise<void>;
    getLocalCopy(fileId: string, localPath: string): Promise<void>;
}

export class LlmAzureStorage implements ILlmStorage {
    private storage: AzureObjectStorage;

    constructor(
        private logger: Logger,
        private llmStorageConfig: IAzureBlobConfig,
    ) {
        this.storage = new AzureObjectStorage(this.logger, this.llmStorageConfig, this.llmStorageConfig.container);
    }

    async addFile(localPath: string, file: LlmFile): Promise<void> {
        await this.storage.uploadLocalFile(file.fileId, localPath);
    }

    async getLocalCopy(fileId: string, localPath: string): Promise<void> {
        await this.storage.downloadBlobToFile(fileId, localPath);
    }

}
