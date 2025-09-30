/* eslint-disable @typescript-eslint/no-explicit-any */
import { EntityNotFound } from "../../model";
import { Logo } from "../../routingservice/v1/contract";
import { Readable } from "stream";
import { TranslationKeys } from "../../../i18n/translations";
import i18next from "../../../i18n";

export class ImageNotFound extends EntityNotFound {
    constructor(id: string) {
        super(i18next.t(TranslationKeys.Visual_NoImageWithId, { id }));
    }
}

// Limit upload to 2GB
export const UPLOAD_MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export type ImageRotation = 0 | 90 | 180 | 270;

export interface Format {
    name: string;
    url: string;
    width: number;
    height: number;
    size: number;
    blobName?: string;
    container?: string;
    itemIdFromStorageLocation?: string;
    visualIdFromStorageLocation?: string;
    keyFramePosition?: number;
}

export interface IDims {
    width: number;
    height: number;
}

export interface VideoFormat extends Format {
    durationInMs?: number;
    videoCodec: string;
    audioCodec: string;
}

export const isVideoFormat = (format: Format): format is VideoFormat =>
    typeof format["videoCodec"] !== "undefined";

export enum VisualKind {
    IMAGE = 0,
    VIDEO = 1
}

interface IVisual<F extends Format> {
    id: string;

    // Origin information
    binderId: string;

    // Visual id from the storageLocation url (if any is found)
    idFromStorageLocation?: string;

    kind: VisualKind;

    // Processing status
    status: VisualStatus;

    // The storage scheme of the ORIGINAL format (a scheme refers to the media storage used)
    scheme?: string;

    // Information on the source
    filename: string;
    extension: string;
    mime: string;
    // MD5 hash of the ORIGINAL format
    md5?: string;

    // Used when a binder is duplicated, then all visuals are copied over
    // this refers to the id of the original binder and original visual id
    originalVisualData?: IOriginalVisualData;

    // eslint-disable-next-line @typescript-eslint/ban-types
    urls: Object;
    formatUrls?: IVisualFormatSpec[];
    manifestUrls?: string[];
    formats: F[];
    languageCodes: string[];

    urlToken?: string;

    // Meta data & settings
    fitBehaviour: string;
    bgColor: string;
    rotation?: ImageRotation;
    audioEnabled?: boolean;
    autoPlay?: boolean;

    commentId?: string;

    created: string;
}

export interface IOriginalVisualData {
    binderId: string;
    originalId: string;
}

type BaseVisualProcessingJob<S = string, T = Record<string, unknown>> = {
    visualId: string;
    step: S;
    stepDetails?: T;
    created: Date;
    updated: Date;
    accountId: string;
    retries?: number;
};

export type TranscodeStepDetails = {
    encodingId: string;
    manifestPaths: string[];
    thumbnailFormats: Format[];
};

export type PendingOnVisualStepDetails = {
    linkedVisualId: string;
};

export enum ProcessingStep {
    /** In a preparatory step */
    PREPROCESSING = "PREPROCESSING",
    /** Pending on original visual to complete reprocessing */
    PENDING_ON_VISUAL = "PENDING_ON_VISUAL",
    TRANSCODING = "TRANSCODING",
    FLAGGED_FOR_REPROCESSING = "FLAGGED_FOR_REPROCESSING",
    FAILURE = "FAILURE",
}

export type FlaggedForReprocessing = BaseVisualProcessingJob<ProcessingStep.FLAGGED_FOR_REPROCESSING>;
export type PreprocessingVisual = BaseVisualProcessingJob<ProcessingStep.PREPROCESSING>;
export type PendingOnVisual = BaseVisualProcessingJob<ProcessingStep.PENDING_ON_VISUAL, PendingOnVisualStepDetails>;
export type TranscodeVisualProcessingJob = BaseVisualProcessingJob<ProcessingStep.TRANSCODING, TranscodeStepDetails>;
export type VisualProcessingJob = PreprocessingVisual | PendingOnVisual | TranscodeVisualProcessingJob | FlaggedForReprocessing;

type IDuplicatedVisual<F extends Format> = IVisual<F> & {
    urlMap: { [oldUrl: string]: string };
};

export type Image = IVisual<Format>;
export type Video = IVisual<VideoFormat>;
export type Visual = Image | Video;

export type VisualFormatType = ImageFormatType | VideoFormatType;

export enum ImageFormatType {
    ORIGINAL = 0,
    MEDIUM = 1,
    THUMBNAIL = 2,
    MEDIUM2 = 3,
    BIG = 4,
    HUGE = 5,
    TINY = 6,
}

export enum VideoFormatType {
    ORIGINAL = 0,
    VIDEO_SCREENSHOT = 101, // THUMBNAIL
    VIDEO_SCREENSHOT_MEDIUM = 1010,
    VIDEO_SCREENSHOT_BIG = 1011, // MEDIUM2
    VIDEO_SCREENSHOT_BIG_2 = 1012,
    VIDEO_SCREENSHOT_HUGE = 1013,
    VIDEO_IPHONE = 102,
    VIDEO_WEB_DEFAULT = 103,
    VIDEO_DEFAULT_HD = 104,
    VIDEO_DEFAULT_SD = 105,
    VIDEO_DEFAULT_LD = 106,
    VIDEO_IPHONE_HD = 107,
    VIDEO_IPHONE_SD = 108,
}

export enum ImageFormatMaxDims {
    ORIGINAL = 0,
    MEDIUM = 300,
    THUMBNAIL = 100,
    MEDIUM2 = 600,
    BIG = 1200,
    HUGE = 2000,
    TINY = 16,
}
export type DuplicatedVisual = IDuplicatedVisual<Format>;

export type VisualFitBehaviour = "fit" | "crop";
export type ImageFitBehaviour = VisualFitBehaviour;

export enum VisualStatus {
    /** visual was freshly created */
    ACCEPTED = "accepted",
    /** processing visual - minimal info (basic screenshots) */
    PROCESSING = "processing",
    /** processing visual in background (transcoding) */
    PROCESSING_BACKGROUND = "processing-background",
    COMPLETED = "completed",
    ERROR = "error",
}

export interface VideoDuration {
    durations: { [id: string]: number };
    skippedVisualIds: string[];
}

export interface IVisualFormatSpec {
    width: number,
    height: number,
    url: string
    name?: string,
    urlToken?: string;
    scheme?: string,
    isVideo: boolean,
    belongsToVideo?: boolean;
    browserSupportsVideoCodec?: boolean; // only relevant for original format
    keyFramePosition?: number;  // only relevant for Bitmovin screenshots
}

export interface IVisualUrlSet {
    formats: IVisualFormatSpec[];
    manifestUrls?: string[];
    contentKeyId?: string;
    // If the video was stored using VideoStorage, then this will be the Sas token to access the container on Azure Storage
    sasToken?: string;
}

export interface IVisualFormatUrlMap {
    [visualId: string]: IVisualUrlSet;
}

export interface IVisualFilter {
    idRegex?: string;
    ids?: string[],
    status?: VisualStatus,
    statuses?: VisualStatus[],
    createdAfter?: Date,
    createdBefore?: Date,
}

export interface IVisualSearchOptions {
    cdnnify?: boolean;
    skipPopulateVisuals?: boolean;
    urlToken?: string;
    ignoreStatus?: boolean;
    visualUsage?: VisualUsage;
}

export interface ITranscriptSection {
    text: string;
    speakerId: string,
    language: string,
    start: string, // "0:00:22.37",
    end: string, // "0:00:28.9"
}

export enum VideoIndexerStatus {
    processing,
    processed,
    failed,
    timeout,
    pending,
}

export interface IVideoIndexerResult {
    msVideoId: string;
    visualId?: string;
    status: VideoIndexerStatus;
    statusExtraInfo?: string;
    transcript?: ITranscriptSection[];
    accountId?: string;
    percentageCompleted: number;
}

export interface IVideoIndexerResultFilter {
    createdBefore?: Date;
    status?: VideoIndexerStatus;
    visualIds?: string[];
}

export enum Dimension {
    Horizontal,
    Vertical,
}

export enum VisualUsage {
    // For visuals used in chunks of binders and publications, also visible in the media library
    BinderChunk = "binder-chunk",
    // For visuals used in reader comments
    ReaderComment = "reader-comment",
}

export interface UploadVisualOptions {
    visualUsage?: VisualUsage;
    commentId?: string;
}

/** Maximum number of attachments allowed per comment */
export const MAX_ATTACHMENTS_PER_COMMENT = 5;
export const MAX_VISUALS_PER_UPLOAD_REQ = 20;

export type BrowserUploadableFile = Blob & { clientId?: string };
export type NodeUploadableFile = Readable;

export type UploadableFile = BrowserUploadableFile | NodeUploadableFile;
export type UploadAttachments = {
    file?: UploadableFile[];
    image?: UploadableFile[];
    logo?: UploadableFile[]
};

export interface ImageServiceContract {
    addLogo(accountId: string, attachments: any, request: any, response: any, next: any): Promise<Logo>;
    listVisuals(binderId: string, options?: IVisualSearchOptions): Promise<Array<Visual>>;
    getFeedbackAttachmentVisuals(binderId: string, options?: IVisualSearchOptions): Promise<Visual[]>;
    getVisual(binderId: string, visualId: string, options?: IVisualSearchOptions): Promise<Visual>;

    duplicateVisuals(binderId: string, targetId: string): Promise<Array<DuplicatedVisual>>;

    uploadVisual(binderId: string, attachments: UploadableFile[], accountId: string, request: any, response: any, next: any, options?: UploadVisualOptions): Promise<Array<string>>;

    deleteImage(binderId: string, imageId: string): Promise<void>;
    deleteVisuals(binderId: string, visualIds: string[]): Promise<void>;
    hardDeleteVisual(binderId: string, visualId: string): Promise<void>;
    hardDeleteVisuals(filter: { binderIds: string[] }): Promise<void>;

    updateImageBgColor(binderId: string, imageId: string, newBgColor: string): Promise<Image>;

    updateVisualFitBehaviour(binderId: string, visualId: string, newFitBehaviour: VisualFitBehaviour): Promise<Visual>;
    updateVisualBgColor(binderId: string, visualId: string, newBgColor: string): Promise<Visual>;
    updateVisualRotation(binderId: string, imageId: string, rotation: ImageRotation): Promise<Visual>;
    updateVisualLanguageCodes(binderId: string, visualId: string, languageCodes: string[]): Promise<Visual>;
    updateVisualAudio(binderId: string, visualId: string, enabled: boolean): Promise<Visual>;
    updateVisualAutoPlay(binderId: string, visualId: string, autoPlay: boolean): Promise<Visual>;

    restartVideoProcessing(visualId: string): Promise<void>;

    getVisualByOriginalVisualData(originalBinderId: string, originalVisualId: string, binderId: string): Promise<Visual>
    queryVideoDurations(videoIds: string[]): Promise<VideoDuration>;
    composeVisualFormatUrls(visualIds: string[], options: IVisualSearchOptions): Promise<IVisualFormatUrlMap>;
    createVideoSasTokens(videoIds: string[]): Promise<Record<string, string>>;

    ensureScreenshotAt(binderId: string, visualId: string, timestampMs: number, accountId: string): Promise<void>;

    videoIndexerCallback(id: string, state: string): Promise<void>;
    findVideoIndexerResults(filter: IVideoIndexerResultFilter): Promise<IVideoIndexerResult[]>;
    indexVideo(visualId: string, accountId: string): Promise<void>;
    getVisualIdByImageUrl(url: string): Promise<string>;
}

export interface ImageServiceContractBuilder {
    addLogo(accountId: string, attachments: any, request: any, response: any, next: any): Promise<Logo>;
    listVisuals(request: any, binderId: string, options?: IVisualSearchOptions): Promise<Array<Visual>>;
    getFeedbackAttachmentVisuals(request: any, binderId: string, options?: IVisualSearchOptions): Promise<Visual[]>;
    duplicateVisuals(request: any, binderId: string, targetId: string): Promise<Array<DuplicatedVisual>>;
    uploadVisual(binderId: string, attachments: UploadableFile[], accountId: string, request: any, response: any, next: any, options?: UploadVisualOptions): Promise<Array<string>>;

    deleteImage(request: any, binderId: string, imageId: string): Promise<void>;
    deleteVisuals(request: any, binderId: string, visualIds: string[]): Promise<void>;
    hardDeleteVisual(request: any, binderId: string, visualId: string): Promise<void>;
    hardDeleteVisuals(request: any, filter: { binderIds: string[] }): Promise<void>;

    updateVisualBgColor(request: any, binderId: string, imageId: string, newBgColor: string): Promise<Image>;
    updateVisualFitBehaviour(request: any, binderId: string, visualId: string, newFitBehaviour: VisualFitBehaviour): Promise<Visual>;
    updateVisualLanguageCodes(request: any, binderId: string, visualId: string, languageCodes: string[]): Promise<Visual>;
    updateVisualRotation(request: any, binderId: string, imageId: string, rotation: string): Promise<Visual>;
    updateVisualAudio(request: any, binderId: string, visualId: string, enabled: boolean): Promise<Visual>;
    updateVisualAutoPlay(request: any, binderId: string, visualId: string, autoPlay: boolean): Promise<Visual>;

    restartVideoProcessing(request: any): Promise<void>;

    downloadScreenshot(binderId: string, visualId: string, keyFrame: string, format: string, request: any, response: any, next: any, width: number, height: number): Promise<void>;
    downloadLogo(accountId: string, logoId: string, request: any, response: any, next: any): Promise<void>;
    downloadVisualBestFit(binderId: string, visualId: string, viewportWidth: number, viewportHeight: number, request: any, response: any, next: any): Promise<void>;
    downloadVisual(binderId: string, visualId: string, format: string, request: any, response: any, next: any): Promise<void>;
    downloadFont(name: string, weight: string, style: string, request: any, response: any, next: any): Promise<void>;
    downloadFontFace(name: string, request: any, response: any, next: any): Promise<void>;
    getVisual(request: any, binderId: string, visualId: string, options?: IVisualSearchOptions): Promise<Visual>;
    getVisualByOriginalVisualData(request: any, originalBinderId: string, originalVisualId: string, binderId: string): Promise<Visual>
    queryVideoDurations(request: any, videoIds: string[]): Promise<VideoDuration>;
    composeVisualFormatUrls(request: any, visualIds: string[], options: IVisualSearchOptions): Promise<IVisualFormatUrlMap>;
    createVideoSasTokens(request: any, videoIds: string[]): Promise<Record<string, string>>;

    ensureScreenshotAt(request: any, binderId: string, visualId: string, timestampMs: number, accountId: string): Promise<void>;

    downloadManifest(assetId: string, manifest: string, token: string, streamingHostname: string, request: any, response: any, next: any): Promise<void>;
    manifestProxy(assetId: string, qualityLevel: string, manifest: string, token: string, streamingHostname: string, request: any, response: any): Promise<void>;
    hlsProxy(targetUrl: string, token: string, response: any): Promise<void>;

    videoIndexerCallback(request: any, id: string, state: string): Promise<void>;
    findVideoIndexerResults(request: any, filter: IVideoIndexerResultFilter): Promise<IVideoIndexerResult[]>;
    indexVideo(request: any, visualId: string, accountId: string): Promise<void>;

    getVisualIdByImageUrl(request: any, url: string): Promise<string>;
}
// tslint:enable:no-any
