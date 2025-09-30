import { Binder, DocumentCollection, Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DuplicatedVisual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { extractImageIdAndFormatFromUrl } from "@binders/client/lib/clients/imageservice/v1/visuals";

export function getBareUrl(url: string): string {
    const pattern = /(.*)\/(images?)\/v1\/binders\/(\S+)\/(\S+)\/(\S*)/;
    const matches = url.match(pattern);
    return matches ?
        `${matches[1]}/${matches[2]}/v1/binders/${matches[3]}/${matches[4]}/` :
        undefined;
}

export const buildGlobalUrlMap = (duplicatedVisuals: DuplicatedVisual[]): { [url: string]: string } => (
    duplicatedVisuals.reduce((reduced, { urlMap }) => {
        const urlsById = Object.keys(urlMap).reduce((urlsSoFar, url) => {
            const [imageId, format] = extractImageIdAndFormatFromUrl(url);
            return Object.assign(urlsSoFar, {
                [`${imageId}_${format.toLowerCase()}`]: urlMap[url],
                [`${imageId}_bare`]: getBareUrl(urlMap[url])
            });
        }, {});
        return Object.assign(reduced, urlsById);
    }, {})
);

export const getUrlTranslation = (
    url: string,
    globalUrlMap: { [url: string]: string },
    srcId?: string
): string => {
    const [imageId = srcId, format] = extractImageIdAndFormatFromUrl(url);
    const formatKey = format && format.toLowerCase();
    if (!imageId || !formatKey) {
        return url;
    }
    if (globalUrlMap[`${imageId}_${formatKey}`]) {
        return globalUrlMap[`${imageId}_${formatKey}`];
    }
    if (globalUrlMap[`${imageId}_original`]) {
        return globalUrlMap[`${imageId}_original`];
    }
    return url;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const extractItemLanguages = (item: Item) => {
    const languageCodes = (item["kind"] === "collection") ?
        (item as DocumentCollection).titles.map(t => t.languageCode) :
        (item as Binder).languages.map(l => l.iso639_1);
    return languageCodes.filter(c => c !== UNDEFINED_LANG);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getExistingPublicationFilter = (
    binderId: string,
    languageCodes: string[]
) => {
    return {
        binderId,
        languageCodes,
        isActive: 1,
        summary: false
    }
}