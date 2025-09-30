import { TranscodeResult, VisualHandler, VisualMetadata } from "./contract";
import { ImageFormatType, } from "@binders/client/lib/clients/imageservice/v1/contract";
import { getImageMetadata } from "../metadata";

export class SvgHandler extends VisualHandler {

    constructor() {
        super();
    }

    getTargetFormats(): ImageFormatType[] {
        return [];
    }

    getMetadata(filePath: string): Promise<VisualMetadata> {
        return getImageMetadata(filePath);
    }

    resize(_path: unknown, _metadata: unknown, _format: unknown): Promise<string> {
        return undefined;
    }

    async transformOriginal(originalImagePath: string, _originalImageMetadata: unknown): Promise<string> {
        return originalImagePath;
    }

    async transcode(): Promise<TranscodeResult> {
        throw new Error("svg handler doesn't implement transcode");
    }
}
