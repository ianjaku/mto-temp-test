import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { CombinedError } from "../CombinedError";
import { FatalVideoError } from "./FatalVideoError";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { NoVideoFormatsError } from "@binders/client/lib/clients/imageservice/v1/visuals";
import VideoJsMediaError from "video.js/dist/types/media-error";
import { isMobileSafari } from "@binders/client/lib/util/browsers";

const IGNORABLE_ERRORS = [
    "request was interrupted by a call to pause",
    "The operation was aborted", // safari version of above error
    "The fetching process for the media resource was aborted", // firefox
];


export function isMediaNotAllowedError(err: Error): boolean {
    return err && err.message && err.message.startsWith("NotAllowedError");
}

export function isMediaErrorIgnorable(err: Error | MediaError | VideoJsMediaError): boolean {
    if (!(err?.message)) {
        return true;
    }
    return IGNORABLE_ERRORS.some(ignErr => new RegExp(ignErr).test(err.message));
}

export function buildStaticVideoSrc(
    media: BinderVisual,
    viewportDims: IDims,
    forceLowResVideo: boolean
): string {
    if (!media.buildRenderUrl) return "";
    return media.buildRenderUrl({
        isMobileSafari: isMobileSafari(navigator.userAgent),
        bestFitOptions: {
            isLandscape: isLandscape(media),
            viewportDims
        },
        forceLowResVideo: forceLowResVideo,
    });
}

export const isLandscape = (media: { formatUrls?: IDims[] }): boolean => {
    if (!media.formatUrls || !media.formatUrls.length) {
        return false;
    }
    const { width, height } = media.formatUrls[0];
    return width > height;
}

export const isStillTranscodingError = (error: Error): boolean => {
    if (error == null) return false;
    if (error instanceof CombinedError) {
        return error.errors.some(isStillTranscodingError);
    }
    if (error instanceof NoVideoFormatsError) return true;
    if (error instanceof FatalVideoError) {
        return error.errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED;
    }
    return false;
}
export const isAnyStillTranscodingError = (errors: Error[]): boolean => {
    return errors.some(isStillTranscodingError);
}

export function getThumbnailRenderUrl(media: BinderVisual, viewportDims: IDims): string {
    return media.buildRenderUrl({
        isMobileSafari: isMobileSafari(navigator.userAgent),
        requestImage: true,
        bestFitOptions: {
            isLandscape: isLandscape(media),
            viewportDims: {
                width: viewportDims.width,
                height: viewportDims.height,
            }
        },
        requestedFormatUrlRegex: ".*/THUMBNAIL_000001.*",
    });
}
