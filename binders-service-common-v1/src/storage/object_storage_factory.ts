import { AzureObjectStorage } from "./azure_object_storage";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "../util/logging";

export interface AzureBlobStoreConfig {
    accessKey: string;
    account: string;
    container?: string;
}

export class ObjectStorageFactory {

    static createAudioStorageFromConfig(
        config: Config,
        logger: Logger
    ): AzureObjectStorage {
        const maybeAudioConfig = config.getObject("azure.blobs.audio");
        if (maybeAudioConfig.isNothing()) {
            throw new Error("Missing config values for azure.blobs.audio");
        }
        const audioConfig = maybeAudioConfig.get() as AzureBlobStoreConfig;
        const { account, accessKey } = audioConfig;
        return new AzureObjectStorage(
            logger,
            { account, accessKey },
            audioConfig.container
        );
    }
}
