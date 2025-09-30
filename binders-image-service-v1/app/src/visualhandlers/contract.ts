import {
    Format,
    ImageFormatMaxDims,
    ImageFormatType,
    TranscodeStepDetails,
    VideoFormat,
    VisualFormatType
} from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    StreamingInfo,
    SupportedAudioCodec,
    SupportedVideoCodec,
    SupportedVideoContainer,
    Visual
} from "../api/model";
import UUID from "@binders/client/lib/util/uuid";
import { tmpdir } from "os";

export type VisualMetadataKind = "video" | "image";

export interface VisualMetadata {
    kind: VisualMetadataKind;
    height: number;
    width: number;
    size: number;
    orientation?: number;
    isProgressive?: boolean;

    // Used in videos to signify if the video has audio
    hasAudio?: boolean;
}

export interface VideoMetadata extends VisualMetadata {
    type: SupportedVideoContainer;
    videoCodec: SupportedVideoCodec;
    audioCodec: SupportedAudioCodec;
    durationInMs?: number;
}


export interface ImageResizeSpec {
    width: number;
    height: number;
    keepAspectRatio: boolean;
}

export interface TranscodeResult {
    streamingInfo: StreamingInfo;
    formats?: (VideoFormat | Format)[];
}

/**
 * Allows the transcoder processing to maintain some internal state
 */
export type TranscodeStepDetailsUpdateFn = (data: TranscodeStepDetails | null) => Promise<void>;

export abstract class VisualHandler {
    getTargetFormats(): ImageFormatType[] {
        return [
            ImageFormatType.MEDIUM,
            ImageFormatType.THUMBNAIL,
            ImageFormatType.MEDIUM2,
            ImageFormatType.BIG,
            ImageFormatType.HUGE,
            ImageFormatType.TINY,
        ];
    }
    abstract getMetadata(filePath: string): Promise<VisualMetadata>;

    /**
     * Attempts to resize the passed in image visual file path
     * @return the resized image file path if successful, <code>undefined</code> otherwise.
     * @throws Error when passed in a video file path
     */
    abstract resize(originalVisualPath: string, originalImageMetadata: VisualMetadata, format: ImageFormatType): Promise<string>;

    abstract transcode(visual: Visual, transcodeStepDetailsUpdateFn?: TranscodeStepDetailsUpdateFn): Promise<TranscodeResult>;
    abstract transformOriginal(originalImagePath: string, originalImageMetadata: VisualMetadata): Promise<string>;

    waitToCompleteTranscode(
        _visual: Visual,
        _encodingId: string,
        _manifestPaths: string[],
        _thumbnailFormats: Format[],
        _transcodeStepDetailsUpdateFn: TranscodeStepDetailsUpdateFn | undefined,
    ): Promise<TranscodeResult> {
        throw new Error("Not implemented");
    }

    static getTempFilePath(): string {
        return tmpdir() + "/" + UUID.random().toString();
    }

    static getImageResizeSpec(format: VisualFormatType): ImageResizeSpec {
        switch (format) {
            case ImageFormatType.MEDIUM:
                return {
                    width: ImageFormatMaxDims.MEDIUM,
                    height: ImageFormatMaxDims.MEDIUM,
                    keepAspectRatio: true
                };
            case ImageFormatType.MEDIUM2:
                return {
                    width: ImageFormatMaxDims.MEDIUM2,
                    height: ImageFormatMaxDims.MEDIUM2,
                    keepAspectRatio: true
                };
            case ImageFormatType.THUMBNAIL:
                return {
                    width: ImageFormatMaxDims.THUMBNAIL,
                    height: ImageFormatMaxDims.THUMBNAIL,
                    keepAspectRatio: true
                };
            case ImageFormatType.BIG:
                return {
                    width: ImageFormatMaxDims.BIG,
                    height: ImageFormatMaxDims.BIG,
                    keepAspectRatio: true
                };
            case ImageFormatType.HUGE:
                return {
                    width: ImageFormatMaxDims.HUGE,
                    height: ImageFormatMaxDims.HUGE,
                    keepAspectRatio: true
                };
            case ImageFormatType.TINY:
                return {
                    width: ImageFormatMaxDims.TINY,
                    height: ImageFormatMaxDims.TINY,
                    keepAspectRatio: true
                };
        }
        throw new Error(`Unknown image format requested: ${format}`);
    }
}
