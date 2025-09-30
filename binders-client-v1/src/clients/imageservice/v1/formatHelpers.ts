import { IVisualFormatSpec } from "./contract";

export function buildUrlFromFormatNames(
    formatNames: string[],
    formatUrls: IVisualFormatSpec[],
    origFormat: IVisualFormatSpec,
): string {
    const requestedFormat: IVisualFormatSpec = formatNames.reduce(
        (foundFormat: IVisualFormatSpec, requestedFormatName: string) => {
            if (foundFormat) {
                return foundFormat;
            }
            return formatUrls.find(f => f.name.toLowerCase() === requestedFormatName.toLowerCase());
        }, undefined);
    const url = requestedFormat?.url || origFormat?.url;
    if (!url) {
        // eslint-disable-next-line no-console
        console.error(`Error in buildUrlFromFormatNames with formatNames ${formatNames.join(",")}, formatUrls`, formatUrls, "and origFormat", origFormat);
        return "";
    }
    return url;
}