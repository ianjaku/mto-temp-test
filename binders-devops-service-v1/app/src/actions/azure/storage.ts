import { AzureObjectStorage, BlobItem } from "@binders/binders-service-common/lib/storage/azure_object_storage";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Progress } from "@binders/client/lib/util/progress";
import { humanizeBytes } from "@binders/client/lib/util/formatting";
import log from "../../lib/logging";

export const storeFileAsBlob = async (
    logger: Logger,
    accessKey: string, account: string,
    container: string, blob: string, localFile: string
): Promise<void> => {
    const azureStorage = new AzureObjectStorage(logger, { accessKey, account }, container);
    await azureStorage.uploadLocalFile(blob, localFile);
};

export const getBlobAsLocalFile = async (
    logger: Logger,
    accessKey: string, account: string,
    container: string, blob: string, localFile: string, printProgress = false
): Promise<void> => {

    let lastPrint = undefined;
    let progress = Progress.empty();
    const onProgress = printProgress ?
        (downloadedBytes: number, totalBytes: number) => {
            const now = new Date().getTime();
            const cutoff = now - 3000;
            if (!lastPrint || lastPrint < cutoff) {
                progress = progress.setTotal(totalBytes).setProcessed(downloadedBytes);
                lastPrint = now;
                log(progress.formatDefault(humanizeBytes));
            }
        } :
        undefined;
    const azureStorage = new AzureObjectStorage(logger, { accessKey, account }, container);
    await azureStorage.downloadBlobToFile(blob, localFile, { onProgress });

}

export const listBlobs = async (logger: Logger, accessKey: string, account: string, container: string): Promise<BlobItem[]> => {
    const connectionDetails = { account, accessKey };
    const storage = new AzureObjectStorage(logger, connectionDetails, container);
    return storage.listBlobs();
};


export const deleteBlob = async (logger: Logger, accessKey: string, account: string, container: string, blob: string): Promise<void> => {
    const storage = new AzureObjectStorage(logger, { account, accessKey }, container);
    await storage.deleteBlob(blob);
};
