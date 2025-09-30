import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { InvocationContext } from "@azure/functions";

function getSecrets(context: InvocationContext) {
    const storageAccount = process.env.NEW_BLOB_STORAGE_ACCOUNT;
    const storageSecret = process.env.NEW_BLOB_STORAGE_SECRET;
    context.log(`Storage account: ${storageAccount}`)
    if (storageAccount && storageSecret) {
        return { storageAccount, storageSecret }
    } else {
        context.log({ storageAccount, oldStorageAccount: process.env.BLOB_STORAGE_ACCOUNT, newStorageAccount: process.env.NEW_BLOB_STORAGE_ACCOUNT })
        throw Error("Missig storage details")
    }
}

async function getBlobServiceClient(context: InvocationContext) {
    const { storageAccount, storageSecret } = getSecrets(context);
    context.log(`Connecting to ${storageAccount} storage account`)
    const sharedKeyCredential = new StorageSharedKeyCredential(storageAccount, storageSecret);
    const blobServiceClientUrl = `https://${storageAccount}.blob.core.windows.net`;
    return new BlobServiceClient(blobServiceClientUrl, sharedKeyCredential);
}

export async function uploadToBlobStorage(context: InvocationContext, localPath: string, resultContainer: string, blobName: string): Promise<void> {
    const blobServiceClient = await getBlobServiceClient(context);
    const containerClient = blobServiceClient.getContainerClient(resultContainer);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
        await blockBlobClient.uploadFile(localPath);
        context.log(`successful upload to ${resultContainer} ${blobName}, path: ${localPath}`);
    } catch (err) {
        context.log(err);
        throw err;
    }
}