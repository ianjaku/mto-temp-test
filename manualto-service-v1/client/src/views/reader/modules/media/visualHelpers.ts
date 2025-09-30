import { IDims, VisualFitBehaviour } from "@binders/client/lib/clients/imageservice/v1/contract";
import { pick } from "ramda";
import styleVars from "../../../../vars.json";

export const getFitBehaviour = (img: { fitBehaviour?: string }): VisualFitBehaviour => {
    return (img.fitBehaviour ? img.fitBehaviour : "fit") as VisualFitBehaviour;
}

export const isLandscape = (media: { formatUrls?: IDims[] }): boolean => {
    if (!media.formatUrls || !media.formatUrls.length) {
        return false;
    }
    const { width, height } = media.formatUrls[0];
    return width > height;
}

export const getVisualRotation = (media: { rotation?: number }): number => {
    return media.rotation ? media.rotation : undefined;
}

export const getOriginalDimensions = (
    media: { formatUrls?: { width: number, height: number, name?: string }[] }
): { width: number, height: number } => {
    const originalFormat = media.formatUrls?.find(format => format.name === "ORIGINAL");
    return originalFormat ?
        pick(["width", "height"], originalFormat) :
        { width: undefined, height: undefined };
}

export const getVisualBackground = (media: { bgColor?: string }): string => {
    if (!media?.bgColor) {
        return "inherit";
    }
    let colorWithoutHash = media.bgColor.replace("#", "");
    if (colorWithoutHash === "transparent") {
        colorWithoutHash = styleVars.bgMedium.replace("#", "");
    }
    return `#${colorWithoutHash}`;
}

export const getShouldAutoPlay = (media: { autoPlay?: boolean }): boolean => {
    return media.autoPlay !== false;
}
