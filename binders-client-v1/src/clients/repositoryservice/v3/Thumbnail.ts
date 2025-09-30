import { IRenderUrlOptions } from "./BinderVisual";
import { IThumbnail } from "./contract";
import { buildTokenUrl } from "../../authorizationservice/v1/helpers";

export default class Thumbnail implements IThumbnail {
    medium: string;
    thumbnail?: string;
    fitBehaviour: string;
    bgColor: string;
    rotation?: string;
    urlToken?: string;

    buildRenderUrl(options: IRenderUrlOptions = {}): string {
        if (options.url) {
            return buildTokenUrl(options.url, this.urlToken);
        }
        const formatNames = options.requestedFormatNames || ["medium"];
        let foundFormatName = formatNames.find(requestedFormatName => this[requestedFormatName]);
        let url = foundFormatName && this[foundFormatName];

        if (!url && this["formatUrls"]) {
            for (const requestedFormatName of formatNames) {
                const format = this["formatUrls"].find(f => f.name && f.name.toLowerCase() === requestedFormatName.toLocaleLowerCase());
                url = format?.url;
                if (url) {
                    break;
                }
            }
        }
        if (!url && this["urls"]) {
            foundFormatName = formatNames.find(requestedFormatName => this["urls"][requestedFormatName]);
            url = foundFormatName && this["urls"][foundFormatName];
        }
        if (!url) {
            // fallback to original (eg for svg's which are not transcoded to other formats)
            const origFormat = this["formatUrls"]?.find(f => f.name && f.name.toLowerCase() === "original");
            url = origFormat?.url || this["urls"]?.original || this.medium;
            if (!url) {
                // eslint-disable-next-line no-console
                console.warn("Could not find suitable render url for Thumbnail", this, "requestedFormatNames", options.requestedFormatNames, "falling back to original");
            }
        }
        if (!url) {
            // eslint-disable-next-line no-console
            console.error("Could not find suitable render url for Thumbnail", this, "requestedFormatNames", options.requestedFormatNames);
        }
        return buildTokenUrl(url, this.urlToken);
    }
}

export type WithOptionalThumbnail = { thumbnail?: IThumbnail };
export type WithThumbnail = { thumbnail?: Thumbnail };

export const withParsedThumbnail = <I>(
    item: I & WithOptionalThumbnail
): I & WithThumbnail => {
    const { thumbnail } = item;
    if (thumbnail == null) return {...item, thumbnail: null};
    const updatedThumbnail = Object.assign(Object.create(Thumbnail.prototype), thumbnail);
    return {
        // eslint-disable-next-line @typescript-eslint/ban-types
        ...(item as Object),
        thumbnail: updatedThumbnail,
    } as I & { thumbnail: Thumbnail };
}
