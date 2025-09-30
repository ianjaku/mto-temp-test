import { Dimension, Format, IDims, IVisualFormatSpec, VisualKind, } from "./contract";
import { getImageSourceBestFit, getVideoSourceBestFit } from "./util";
import { IRenderUrlOptions } from "../../repositoryservice/v3/BinderVisual";
import { buildTokenUrl } from "../../authorizationservice/v1/helpers";
import { buildUrlFromFormatNames } from "./formatHelpers";
import { validateViewPortDimensions } from "../../publicapiservice/v1/validation";

// Two formats are considered the same if the difference in keyFramePosition (seconds) is less than this value
export const TRIMMING_MATCH_TOLERANCE_SEC = 0.1;

export abstract class VisualAbstract {
    id: string;
    formatUrls: IVisualFormatSpec[];
    urlToken?: string;
    fitBehaviour: "fit" | "crop";
    bgColor: string;
    languageCodes: string[];
    status: string;
    kind?: VisualKind;
    manifestUrls?: string[];
    sasToken?: string;
    audioEnabled?: boolean;
    autoPlay?: boolean;
    rotation?: number;

    abstract isVideo(): boolean;
    abstract buildFallbackUrl(): string|undefined;

    getAspectRatio(): number {
        const formatWithWidth = this.formatUrls.find(u => !!u.width && !!u.height);
        if (!formatWithWidth) {
            return 1;
        }
        const { width, height } = formatWithWidth;
        return !!width && !!height && width / height;
    }

    /*
        Get the dimension that needs to be used to stretch the image according to a given viewport
    */
    getFillDimension(viewportDims: IDims): Dimension {
        const { width: viewportWidth, height: viewportHeight } = viewportDims;
        const formatWithDims = this.formatUrls.find(u => !!u.width && !!u.height);
        const imageWidth = formatWithDims.width;
        const imageHeight = formatWithDims.height;
        const isFit = this.fitBehaviour === "fit";
        const viewportIsWidest = imageHeight / imageWidth > viewportHeight / viewportWidth;
        const landscape = isFit ? Dimension.Vertical : Dimension.Horizontal;
        const portrait = isFit ? Dimension.Horizontal : Dimension.Vertical;
        return viewportIsWidest ? landscape : portrait;
    }

    buildRenderUrl(options?: IRenderUrlOptions): string|undefined {
        const { formatUrls, urlToken } = this;
        const isVid = this.isVideo();

        const {
            requestImage = false,
            requestedFormatNames,
            bestFitOptions,
            forceLowResVideo = false,
            requestedFormatUrlRegex
        } = options ?? {};
        const { isLandscape, viewportDims } = bestFitOptions ?? {};

        if (options?.url) {
            return buildTokenUrl(options.url, urlToken);
        }
        if (!formatUrls) {
            return this.buildFallbackUrl();
        }

        if (isVid && options?.timeMs != null && options.timeMs > 0) {
            const formatNearTimeMs = formatUrls.find(f => f.keyFramePosition && Math.abs(f.keyFramePosition - (options.timeMs/1000)) <= TRIMMING_MATCH_TOLERANCE_SEC);
            if (formatNearTimeMs) {
                return buildTokenUrl(formatNearTimeMs.url, urlToken);
            } else {
                return null;
            }
        }
        
        if (isVid && forceLowResVideo) {
            const videoFormats = formatUrls
                .filter(f => f.isVideo && f.name !== "ORIGINAL")
                .sort((a, b) => a.width - b.width);
            const format = videoFormats.length ? videoFormats[0] : videoFormats.find(f => f.name === "ORIGINAL");
            const src = format && format.url;
            if (src) {
                return buildTokenUrl(src, urlToken);
            }
        }
        const origFormat = formatUrls.find(f => f.name === "ORIGINAL");

        // if none of above cases, dynamically build url based on best fit
        if (requestedFormatNames) {

            if (isVid && !(options.requestImage)) {
                const videoScreenshotUrl = this.getVideoScreenshotUrl();
                return videoScreenshotUrl && buildTokenUrl(videoScreenshotUrl, urlToken);
            }

            const url = buildUrlFromFormatNames(requestedFormatNames, formatUrls, origFormat);
            return urlToken ? buildTokenUrl(url, urlToken) : url;
        }
        const validViewportDims = validateViewPortDimensions(viewportDims).length === 0;

        if (!validViewportDims) {
            return this.buildFallbackUrl();
        }

        const isFit = this.fitBehaviour === "fit";
        const formatUrlCandidates = requestImage ?
            formatUrls.filter(({ isVideo }) => !isVideo) :
            formatUrls;
        const bestFittingFormat = this.isVideo() && !requestImage ?
            getVideoSourceBestFit({
                formats: formatUrlCandidates,
                isFit,
                isLandscape,
                viewportDims,
            }) :
            getImageSourceBestFit({
                formats: formatUrlCandidates,
                isFit,
                isLandscape,
                viewportDims,
                requestedFormatUrlRegex,
            });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = bestFittingFormat ? bestFittingFormat.url : (this as any).url;
        return urlToken ? buildTokenUrl(url, urlToken) : url;
    }

    getVideoScreenshotUrl(): string {
        if (!this.isVideo() || !this.formatUrls) {
            return "";
        }
        const screenshotFormat = this.formatUrls.find(f => f.name === "VIDEO_SCREENSHOT");
        return screenshotFormat && screenshotFormat.url;
    }
}

export class Visual extends VisualAbstract {
    idFromStorageLocation?: string;
    scheme?: string;
    created: string;
    binderId: string;
    filename: string;
    extension: string;
    mime: string;
    // eslint-disable-next-line @typescript-eslint/ban-types
    urls: Object;
    formats: Format[];

    isVideo(): boolean {
        return this.kind === VisualKind.VIDEO;
    }

    buildFallbackUrl(): string|undefined {
        const { urlToken } = this;
        const url = this.urls && this.urls["medium"];
        if (!url) {
            return undefined;
        }
        return urlToken ? buildTokenUrl(url, urlToken) : url;
    }

}
