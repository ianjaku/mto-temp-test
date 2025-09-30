import { IDims, IVisualFormatSpec } from "./contract";
import { NoVideoFormatsError } from "./visuals";

function sortFormatsAscending(f1: IVisualFormatSpec, f2: IVisualFormatSpec) {
    return f1.width < f2.width ? -1 : 1;
}

function sortFormatsDescending(f1: IVisualFormatSpec, f2: IVisualFormatSpec) {
    return f1.width < f2.width ? 1 : -1;
}

export const isVideoTranscodingFinished = (formats: IVisualFormatSpec[]): boolean => {
    return formats.some(f => f.isVideo && isSupportedVideoFormat(f) && isTranscodedFormat(f));
}

const isOriginalFormat = (format: IVisualFormatSpec) => format.name?.toLowerCase() === "original";
const isTranscodedFormat = (format: IVisualFormatSpec) =>  !isOriginalFormat(format) && !format.name?.startsWith("VIDEO_IPHONE");
const isSupportedVideoFormat = (format: IVisualFormatSpec) => format.browserSupportsVideoCodec;
const isVideoScreenshot = (format: IVisualFormatSpec) => format.name.toUpperCase().startsWith("VIDEO_SCREENSHOT");

export type GetVisualSourceBestFitOptions = {
    formats: IVisualFormatSpec[];
    isFit: boolean;
    isLandscape: boolean;
    viewportDims?: IDims;
}

export const getVideoSourceBestFit = ({
    fallbackToScreenshot,
    formats,
    isFit,
    isLandscape,
    viewportDims,
}: GetVisualSourceBestFitOptions & { fallbackToScreenshot?: boolean }
): IVisualFormatSpec => {
    const videoFormats = formats.filter(format => format.isVideo);
    const supportedVideoFormats = videoFormats.filter(isSupportedVideoFormat);
    const originalFormats = supportedVideoFormats.filter(isOriginalFormat);
    const transcodedFormats = supportedVideoFormats.filter(isTranscodedFormat);
    // if other video formats are present, filter out the original
    const relevantFormats = transcodedFormats.length > 0 ? transcodedFormats : originalFormats;
    if (originalFormats.length + relevantFormats.length === 0) {
        if (!fallbackToScreenshot) {
            throw new NoVideoFormatsError();
        }
        const screenshot = getVideoScreenshot({ formats, isFit, isLandscape, viewportDims });
        if (!screenshot) {
            throw new NoVideoFormatsError()
        }
        return screenshot;
    }
    const visualFormat = getVisualSourceBestFit(relevantFormats, isFit, isLandscape, viewportDims);
    return visualFormat;
}

export const getVideoScreenshot = ({
    formats,
    isFit,
    isLandscape,
    viewportDims,
}: GetVisualSourceBestFitOptions): IVisualFormatSpec => {
    const screenshots = formats.filter(isVideoScreenshot);
    return getVisualSourceBestFit(screenshots, isFit, isLandscape, viewportDims);
}

export const getImageSourceBestFit = ({
    formats,
    isFit,
    isLandscape,
    requestedFormatUrlRegex,
    viewportDims,
}: GetVisualSourceBestFitOptions & { requestedFormatUrlRegex?: string }): IVisualFormatSpec => {
    const normalizedFormats = formats.some(f => f.name === "HUGE") ?
        formats.filter(f => f.name !== "ORIGINAL") : // Temp hotfix, should be properly fixed in MT-3099
        formats;
    return getVisualSourceBestFit(normalizedFormats, isFit, isLandscape, viewportDims, requestedFormatUrlRegex);
}

const getVisualSourceBestFit = (
    formats: IVisualFormatSpec[],
    isFit: boolean,
    isLandscape: boolean,
    viewportDims?: IDims,
    requestedFormatUrlRegex?: string,
): IVisualFormatSpec => {
    if (requestedFormatUrlRegex) {
        const format = formats.find(f => new RegExp(requestedFormatUrlRegex).test(f.url));
        if (format) {
            return format;
        }
    }
    const { width: viewportWidth, height: viewportHeight } = viewportDims || { width: 800, height: 800 };

    const fitsInViewportFn = ((isFit && isLandscape) || (!isFit && !isLandscape)) ?
        (formatWidth: number) => formatWidth >= viewportWidth :
        (_: unknown, formatHeight: number) => formatHeight >= viewportHeight;

    const candidateFormats = [];
    for (const imageFormatSpec of formats) {
        const { width: formatWidth, height: formatHeight } = imageFormatSpec;
        if (fitsInViewportFn(formatWidth, formatHeight)) {
            candidateFormats.push(imageFormatSpec);
        }
    }

    if (!(candidateFormats.length)) {
        // all the candidates are smaller than viewport, pick largest
        return [...formats.sort(sortFormatsAscending)].pop();
    }
    // multiple candidates are larger than viewport, pick smallest
    return [...candidateFormats.sort(sortFormatsDescending)].pop();
}
