import { Format, ImageFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";
import { Image, visualFormatTypeToString } from "../api/model";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { MediaStorage } from "../storage/contract";
import { VisualHandler } from "../visualhandlers/contract";
import { VisualHandlers } from "../api/visualhandlers";
import { safeDeleteFile } from "../helper/filesystem";

type UploadFileFormatFn = (localPath: string, format: ImageFormatType) => ReturnType<MediaStorage["addFile"]>;

export function resizeImage(image: Image, storage: MediaStorage, logger: Logger): Promise<Format[]> {
    const visualHandler = VisualHandlers.get(image.mime, logger);
    const uploadFileFormat: UploadFileFormatFn = (localPath, format) => storage.addFile(localPath, image.binderId, image.id, image.mime, format);
    return storage.withLocalCopy(image, ImageFormatType.ORIGINAL, async originalFilePath => {
        const formats = await resizeAndUploadFormats(originalFilePath.path, visualHandler, uploadFileFormat, logger);
        return formats.filter(format => format);
    });
}

async function resizeAndUploadFormats(
    originalFilePath: string,
    visualHandler: VisualHandler,
    uploadFileFormat: UploadFileFormatFn,
    logger: Logger
): Promise<(Format | undefined)[]> {
    const metadata = await visualHandler.getMetadata(originalFilePath);
    const resizeAndUploadFormat = async (format: ImageFormatType) => {
        const resizedImagePath = await visualHandler.resize(originalFilePath, metadata, format);
        if (resizedImagePath == null) return undefined;
        try {
            const storageDetails = await uploadFileFormat(resizedImagePath, format);
            return {
                ...storageDetails.format,
                name: visualFormatTypeToString(storageDetails.format.format),
                url: undefined, // Upon save, when url is undefined, we'll build the storage location url
            };
        } finally {
            await safeDeleteFile(resizedImagePath, logger);
        }
    };
    return Promise.all(visualHandler.getTargetFormats().map(resizeAndUploadFormat));
}