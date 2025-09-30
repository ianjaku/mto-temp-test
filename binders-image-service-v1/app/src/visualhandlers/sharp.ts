/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from "fs";
import * as path from "path";
import { ImageFormatMaxDims, ImageFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";
import { TranscodeResult, VisualHandler, VisualMetadata } from "./contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import UUID from "@binders/client/lib/util/uuid";
import { getImageMetadata } from "../metadata";
import sharp from "sharp";
import { tmpdir } from "os";

export async function convertTiffToJpg(tiffPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const jpgPath = path.join(tmpdir(), `${UUID.random().toString()}.jpg`);
        const targetStream = fs.createWriteStream(jpgPath);
        const jpegTransformer = sharp().jpeg();
        const tiffStream = fs.createReadStream(tiffPath);
        tiffStream
            .pipe(jpegTransformer)
            .pipe(targetStream);
        targetStream.on("close", () => {
            tiffStream.close();
            resolve(jpgPath);
        });
        targetStream.on("error", reject);
    });
}

export class SharpHandler extends VisualHandler {

    constructor(private logger: Logger) {
        super();
    }

    getMetadata(filePath: string): Promise<VisualMetadata> {
        return getImageMetadata(filePath);
    }

    async resize(originalImagePath: string, originalImageMetadata: VisualMetadata, format: ImageFormatType): Promise<string> {
        const resizeSpec = VisualHandler.getImageResizeSpec(format)
        if (resizeSpec.width > ImageFormatMaxDims.MEDIUM &&
            (originalImageMetadata.width < resizeSpec.width || originalImageMetadata.height < resizeSpec.height)) {

            this.logger.debug(
                `Cannot upscale image: ${originalImagePath}`,
                "sharp-handler",
                { resizeSpec, originalImageMetadata }
            );
            return undefined;
        }
        const outputPath = VisualHandler.getTempFilePath();
        const resizeOptions: sharp.ResizeOptions = resizeSpec.keepAspectRatio ?
            { fit: "inside" } :
            { fit: "cover" };
        const afterCropOrFit = sharp(originalImagePath, { failOn: "error" })
            .clone()
            .resize(resizeSpec.width, resizeSpec.height, resizeOptions);
        let afterRotate = afterCropOrFit;
        if ([6, 3, 8].includes(originalImageMetadata.orientation)) {
            let angle: number | undefined;
            switch (originalImageMetadata.orientation) {
                case 6:
                    angle = 90;
                    break;
                case 8:
                    angle = 270;
                    break;
                default:
                    angle = 180;
            }
            afterRotate = afterCropOrFit.rotate(angle);
        }
        await afterRotate
            .withMetadata()
            .toFile(outputPath);

        return outputPath;
    }

    async transformOriginal(originalImagePath: string, originalImageMetadata: VisualMetadata): Promise<string> {
        if ([6, 3, 8].indexOf(originalImageMetadata.orientation) !== -1) {
            let angle: number | undefined;
            switch (originalImageMetadata.orientation) {
                case 6:
                    angle = 90;
                    break;
                case 8:
                    angle = 270;
                    break;
                default:
                    angle = 180;
            }

            const buffer = await sharp(originalImagePath)
                .rotate(angle)
                .toBuffer(); 
            await fs.promises.writeFile(originalImagePath, buffer);
        }
        return originalImagePath;
    }

    async transcode(): Promise<TranscodeResult> {
        throw new Error("sharp handler doesn't implement transcode");
    }
}
