import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

const CATEGORY = "screenshot-worker-blobStorage"

function getSecrets(config: BindersConfig) {
    const storageAccount = config.getString("azure.blobs.videos-v2.account").get();
    const storageSecret = config.getString("azure.blobs.videos-v2.accessKey").get();
    if (storageAccount && storageSecret) {
        return { storageAccount, storageSecret }
    } else {
        throw Error("Missig storage connection data")
    }
}

async function getBlobServiceClient(config: BindersConfig, logger: Logger) {
    const { storageAccount, storageSecret } = getSecrets(config);
    logger.info(`Connecting to ${storageAccount} storage account`, CATEGORY)
    const sharedKeyCredential = new StorageSharedKeyCredential(storageAccount, storageSecret);
    const blobServiceClientUrl = `https://${storageAccount}.blob.core.windows.net`;
    return new BlobServiceClient(blobServiceClientUrl, sharedKeyCredential);
}

export async function uploadToBlobStorage(config: BindersConfig, logger: Logger, localPath: string, resultContainer: string, blobName: string): Promise<void> {
    const blobServiceClient = await getBlobServiceClient(config, logger);
    const containerClient = blobServiceClient.getContainerClient(resultContainer);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
        await blockBlobClient.uploadFile(localPath);
        logger.info(`successful upload to ${resultContainer} ${blobName}, path: ${localPath}`, CATEGORY);
    } catch (err) {
        const { stack, message, name } = err;  // Azure errors also contain the request and response objects which are huge
        logger.error(`Error when uploading to blob storage to ${resultContainer} ${blobName}, path: ${localPath}`, CATEGORY, { stack, message, name });
        throw err;
    }
} 