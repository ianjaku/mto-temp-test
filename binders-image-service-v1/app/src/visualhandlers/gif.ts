import { ImageResizeSpec, TranscodeResult, VisualHandler, VisualMetadata } from "./contract";
import { ImageFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { getImageMetadata } from "../metadata";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const exec = require("child-process-promise").exec;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shellescape = require("shell-escape");

export class GifHandler extends VisualHandler {

    constructor(private readonly logger: Logger) {
        super();
    }

    getMetadata(filePath: string): Promise<VisualMetadata> {
        return getImageMetadata(filePath);
    }

    private getResizeCommand(sourcePath: string, resizeSpec: ImageResizeSpec, outputPath: string): string {
        return shellescape([
            "gifsicle",
            resizeSpec.keepAspectRatio ? "--resize-fit" : "--resize",
            `${resizeSpec.width}x${resizeSpec.height}`,
            sourcePath,
            "-o",
            outputPath
        ]);
    }

    async resize(originalImagePath: string, originalMetadata: VisualMetadata, format: ImageFormatType): Promise<string> {
        const resizeSpec = VisualHandler.getImageResizeSpec(format);
        const outputPath = VisualHandler.getTempFilePath();
        if (originalMetadata.width < resizeSpec.width || originalMetadata.height < resizeSpec.height) {
            this.logger.debug(`Cannot upscale gif: ${originalImagePath}`, "gif-handler", { resizeSpec, originalMetadata });
            return undefined;
        } else {
            const resizeCommand = this.getResizeCommand(originalImagePath, resizeSpec, outputPath);
            await exec(resizeCommand);
            return outputPath;
        }
    }

    async transformOriginal(originalImagePath: string, _originalImageMetadata: unknown): Promise<string> {
        return originalImagePath;
    }

    async transcode(): Promise<TranscodeResult> {
        throw new Error("GIF handler doesn't implement transcode");
    }
}