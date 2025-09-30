import { IBinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import ThumbnailObj from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { isDev } from "@binders/client/lib/util/environment";

/**
 * Extracts the screenshot visual urls from the passed in visuals.
 */
export const getScreenshotUrlsFromVisual = (
    visual: IBinderVisual,
    serviceVisual: Visual,
    cdnnify: boolean,
    imageServiceHost: string,
    isPreview: boolean,
    binderId: string
): string[] => {
    if (!cdnnify || !["azurems:", "video-v2:"].includes(serviceVisual.scheme)) {
        const visualObj = Object.assign(Object.create(ThumbnailObj.prototype), { ...visual, urlToken: serviceVisual.urlToken });
        const visualId = visual.id || findVisualIdFromUrl(visual.url);
        const screenshotUrls: string[] = [];
        const visualBaseUrl = fixDevUrl(visual.url.replace(/\/(images?)\/v(\d).+/, "/$1/v$2"), imageServiceHost, isPreview);
        while (screenshotUrls.length < 9) {
            const index = screenshotUrls.length + 1;
            const screenshotUrl = `${visualBaseUrl}/screenshots/${binderId}/${visualId}/KEY_FRAME_${index}/VIDEO_SCREENSHOT_BIG`;
            screenshotUrls.push(visualObj.buildRenderUrl({ url: screenshotUrl }));
        }
        return screenshotUrls;
    } else {
        const formatSpecsWithNonNullKeyFramePositions = serviceVisual.formatUrls
            .filter(formatSpec => formatSpec.keyFramePosition != null);
        // only screenshots from the Bitmovin transcoded videos have the keyFramePosition set
        if (formatSpecsWithNonNullKeyFramePositions.length > 0) {
            return formatSpecsWithNonNullKeyFramePositions
                .sort((left, right) => left.keyFramePosition - right.keyFramePosition)
                .map(formatSpec => formatSpec.url);
        } else {
            return serviceVisual.formatUrls
                .filter(formatSpec => formatSpec.name === "VIDEO_SCREENSHOT_BIG")
                .map(formatSpec => formatSpec.url);
        }
    }
};

export const findVisualIdFromUrl = (url: string): string => {
    return url.split("/").find(p => p.indexOf("vid-") === 0 || p.indexOf("img-") === 0);
};

export function fixDevUrl(url: string, imageServiceHost: string, isPreview: boolean): string {
    // TODO: use the one from the client package
    const useUrl = !isDev() || isPreview || url.indexOf("manual.to-logo.svg") > -1;
    return useUrl ? url : url.replace(/http(s)?:\/\/(.)+:(\d)+/, imageServiceHost);
}