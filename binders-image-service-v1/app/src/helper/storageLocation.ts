import { ImageFormat, VideoFormat } from "../api/model"

export function replaceStorageAccountInStorageLocation(formats: ImageFormat[] | VideoFormat[], oldStorageAccount: string, newStorageAccount: string): ImageFormat[] | VideoFormat[] {
    return formats.map(format => {
        const regex = new RegExp(`azure://${oldStorageAccount}/`, "g");
        format.storageLocation = format.storageLocation.replace(regex, `azure://${newStorageAccount}/`);
        return format
    })
}