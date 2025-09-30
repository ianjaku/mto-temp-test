import {
    IOriginalVisualData,
    ImageFormatType,
    ImageRotation,
    VideoFormatType,
    VisualFitBehaviour,
    VisualFormatType,
    VisualStatus,
    VisualUsage,
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { Either } from "@binders/client/lib/monad";
import { EntityIdentifier } from "@binders/binders-service-common/lib/model/entities";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import UUID from "@binders/client/lib/util/uuid";

export abstract class VisualIdentifier extends EntityIdentifier<string> {
    static generate(mime: string): VisualIdentifier {
        if (mime.startsWith("video")) {
            return VideoIdentifier.generate();
        }
        else {
            return ImageIdentifier.generate();
        }
    }

    static parse(idString: string): VisualIdentifier {
        if (isVideoIdString(idString)) {
            return new VideoIdentifier(idString);
        }
        return new ImageIdentifier(idString);
    }
}


export class ImageIdentifier extends VisualIdentifier {
    static IMAGE_MODULE_VISUALPREFIX = "img-";

    static PREFIX = ImageIdentifier.IMAGE_MODULE_VISUALPREFIX;

    assert(id: string): void {
        if (!id?.startsWith(ImageIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid image id '${id}'`);
        }
    }

    static generate(): ImageIdentifier {
        const id = UUID.randomWithPrefix(ImageIdentifier.IMAGE_MODULE_VISUALPREFIX);
        return new ImageIdentifier(id);
    }

    static build(key: string): Either<Error, ImageIdentifier> {
        try {
            return Either.right<Error, ImageIdentifier>(new ImageIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}


export class VideoIdentifier extends VisualIdentifier {

    static IMAGE_MODULE_VISUALPREFIX = "vid-";

    static PREFIX = VideoIdentifier.IMAGE_MODULE_VISUALPREFIX;

    assert(id: string): void {
        if (!id?.startsWith(VideoIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid video id '${id}'`);
        }
    }

    static generate(): VideoIdentifier {
        const id = UUID.randomWithPrefix(VideoIdentifier.IMAGE_MODULE_VISUALPREFIX);
        return new VideoIdentifier(id);
    }

    static build(key: string): Either<Error, VideoIdentifier> {
        try {
            return Either.right<Error, VideoIdentifier>(new VideoIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}

export class LogoIdentifier extends EntityIdentifier<string> {
    static readonly PREFIX = "logo-";

    protected assert(id: string): void {
        if (!id || !id.startsWith(LogoIdentifier.PREFIX)) {
            throw new InvalidArgument(`Invalid logo id '${id}'`);
        }
    }

    static generate(): LogoIdentifier {
        const id = UUID.randomWithPrefix(LogoIdentifier.PREFIX);
        return new LogoIdentifier(id);
    }

    static build(key: string): Either<Error, LogoIdentifier> {
        try {
            return Either.right<Error, LogoIdentifier>(new LogoIdentifier(key));
        }
        catch (error) {
            return Either.left(error);
        }
    }
}


export function visualFormatTypeToString(format: VisualFormatType): string {
    if (format === undefined) {
        return "";
    }
    if (format < VideoFormatType.VIDEO_SCREENSHOT) {
        return ImageFormatType[format];
    }
    return VideoFormatType[format];
}

export function stringToVisualFormatType(stringValue: string): VisualFormatType {
    if (stringValue.startsWith("VIDEO")) {
        return VideoFormatType[stringValue];
    }
    return ImageFormatType[stringValue];
}

function normalizePositiveInt(n: number, name: string, logger?: Logger) {
    if (n < 0) {
        throw new InvalidArgument(`${name} must be positive (${n})`);
    }
    if (n % 1 !== 0) {
        if (logger) {
            logger.warn(`${name} is not an integer (${n}). Rounding...`, "normalizePositiveInt");
        }
        return Math.round(n);
    }
    return n;
}

export const SCREENSHOTS_FORMATS: VisualFormatType[] = [
    VideoFormatType.VIDEO_SCREENSHOT, // THUMBNAIL
    VideoFormatType.VIDEO_SCREENSHOT_MEDIUM,
    VideoFormatType.VIDEO_SCREENSHOT_BIG, // MEDIUM2
    VideoFormatType.VIDEO_SCREENSHOT_BIG_2,
    VideoFormatType.VIDEO_SCREENSHOT_HUGE,
];

export function isScreenshotFormat(format: VisualFormatType): boolean {
    return SCREENSHOTS_FORMATS.indexOf(format) > -1;
}

export type VisualFormat = ImageFormat | VideoFormat;

interface BaseVisualFormat {
    format: VisualFormatType,
    width: number,
    height: number,
    storageLocation: string,
    container: string,
    size: number,
}

export class ImageFormat implements BaseVisualFormat {
    constructor(
        public format: VisualFormatType,
        public width: number,
        public height: number,
        public size: number,
        public readonly storageLocation: string,
        public readonly container: string,
        public readonly logger?: Logger,
        public readonly keyFramePosition?: number,
    ) {
        this.width = normalizePositiveInt(width, "width", logger);
        this.height = normalizePositiveInt(height, "height", logger);
        this.size = normalizePositiveInt(size, "size", logger);
    }
}


export class VideoFormat implements BaseVisualFormat {

    public storageLocationPreBitmovin?: string;
    public containerPreBitmovin?: string;

    constructor(
        public format: VisualFormatType,
        public width: number,
        public height: number,
        public size: number,
        public readonly videoCodec: SupportedVideoCodec,
        public readonly audioCodec: SupportedAudioCodec,
        public storageLocation: string,
        public readonly container: string,
        public durationInMs?: number,
        public readonly logger?: Logger,
        public readonly hasAudio?: boolean,
        public readonly keyFramePosition?: number,
    ) {
        this.durationInMs = durationInMs ? normalizePositiveInt(durationInMs, "durationInMs", logger) : undefined;
        this.width = normalizePositiveInt(width, "width", logger);
        this.height = normalizePositiveInt(height, "height", logger);
        this.size = normalizePositiveInt(size, "size", logger);
    }
}

export interface IVisual<I extends VisualIdentifier, F extends VisualFormat> {
    id: I;
    originalVisualData?: IOriginalVisualData,
    binderId: string;
    filename: string;
    extension: string;
    md5: string;
    mime: string;
    status: VisualStatus;
    created: Date;
    formats: F[];
    fitBehaviour?: VisualFitBehaviour;
    bgColor?: string;
    languageCodes?: string[];
    rotation?: ImageRotation;
    audioEnabled?: boolean;
    autoPlay?: boolean;
    reprocessCount?: number;
    streamingInfo?: StreamingInfo;
    hasAudio?: boolean;
    usage: VisualUsage;

    commentId?: string;
}

export type Image = IVisual<ImageIdentifier, ImageFormat>;

export type Video = IVisual<VideoIdentifier, VideoFormat>

export type Visual = Image | Video;

export enum SupportedImageType {
    GIF,
    JPEG,
    JPG,
    TIFF,
    PNG,
    WEBP
}

export enum SupportedVideoContainer {
    MP4 = 0,
    QUICKTIME = 1,
    AVI = 2,
    FLV = 3,
    WMV = 4,
    WEBM = 5,
    AVC1 = 6
}

export enum SupportedVideoCodec {
    H264 = 0,
    MJPEG = 1,
    HEVC = 2,
    VP6F = 3,
    FLV1 = 4,
    WMV1 = 5,
    MPEG = 6,
    H263 = 7,
    VP8 = 8,
    // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
    VP9 = 8,
    MSV1 = 9
}

export enum SupportedAudioCodec {
    NO_AUDIO = -1,
    AAC = 0,
    PCM_S16LE = 1,
    AC3 = 2,
    MP3 = 3,
    WMAV2 = 4,
    PCM_S16BE = 5,
    OPUS = 8,
}

export function isVideoFormat(format: VisualFormat): format is VideoFormat {
    return "videoCodec" in format;
}

export function isVideo(visual: Visual): visual is Video {
    return isVideoId(visual.id);
}

export function isVideoId(visualId: VisualIdentifier): boolean {
    return isVideoIdString(visualId.value());
}

export function isVideoIdString(visualId: string): boolean {
    return visualId.startsWith(VideoIdentifier.PREFIX);
}

export interface StreamingInfo {
    manifestPaths: string[];
    streamingHostname: string;
    contentKeyId: string;
    manifestPathsPreBitmovin?: string[];
    streamingHostnamePreBitmovin?: string;
    contentKeyIdPreBitmovin?: string;
}


export type ScreenshotResult = {
    Payload: {
        format: VideoFormatType,
        width: number,
        height: number,
        dimensions: string,
        size: number,
        formatName: string,
    }
}[]