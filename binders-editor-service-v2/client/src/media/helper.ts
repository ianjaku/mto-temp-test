import * as FileSaver from "file-saver";
import { Binder, IBinderVisual, VisualSettings } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IPreviewVisual, IVisualPosition } from "../documents/Composer/contract";
import { ImageFormatType, VisualKind } from "@binders/client/lib/clients/imageservice/v1/contract";
import { extractIdFromUrl, isPlaceholderVisual, isVideoId } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { flatten, pick, pickBy } from "ramda";
import { BinderMediaStoreActions } from "./binder-media-store";
import { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail/index";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { buildTokenUrl } from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import { isIE } from "@binders/client/lib/react/helpers/browserHelper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const extractVisualsFromBinder = (binder: Binder): IBinderVisual[] => {
    const visuals = [];
    const imagesMetaModule = binder.modules.meta.find(m => m.type === "images");
    if (!imagesMetaModule || !binder.modules.images) {
        return visuals;
    }
    const imagesChunked = binder.modules.images.chunked.find(ch => ch.key === imagesMetaModule.key);
    if (!imagesChunked || !imagesChunked.chunks) {
        return visuals;
    }
    const thumbnailVisual = isPlaceholderVisual(binder.thumbnail.medium) ?
        [] :
        [thumbnailToVisual(binder.thumbnail)];
    return flatUnique([thumbnailVisual].concat(imagesChunked.chunks));
}

const AVAILABLE_VISUAL_SIZES = [
    "original",
    "medium",
    "thumbnail",
    "medium2",
    "big",
    "huge",
    "video_screenshot",
    "video_screenshot_big",
    "tiny",
];
export const toDifferentSizeVisualUrl = (visualUrl: string, sizeIndicator: string): string => {
    const url = visualUrl.trim().endsWith("/") ? visualUrl.slice(0, -1) : visualUrl;
    const urlParts = url.split("/");
    if ((urlParts[3] !== "images" && urlParts[3] !== "image") || !urlParts[4] || !urlParts[4].startsWith("v")) {
        return visualUrl;
    }
    const currentSizeIndicator = urlParts.pop();
    return AVAILABLE_VISUAL_SIZES.includes(currentSizeIndicator) ?
        url.replace(new RegExp(`/${currentSizeIndicator}$`), `/${sizeIndicator}`) :
        `${url}/${sizeIndicator}`;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const toBinderVisual = (clientVisual: any): any => {
    if (clientVisual.id) {
        const url = (clientVisual.kind === VisualKind.VIDEO || clientVisual.id.startsWith("vid-")) ?
            (clientVisual.urls && clientVisual.urls.video_screenshot) || (clientVisual.url && toDifferentSizeVisualUrl(clientVisual.url, "video_screenshot")) :
            (clientVisual.urls && (clientVisual.urls.medium || clientVisual.urls.original)) || (clientVisual.url && toDifferentSizeVisualUrl(clientVisual.url, "medium"));
        return Object.assign(Object.create(Object.getPrototypeOf(clientVisual)), clientVisual, { url, sizeUrls: clientVisual.urls });
    }
    const id = clientVisual.url ?
        extractIdFromUrl(clientVisual.url) || clientVisual.url :
        clientVisual;
    const url = clientVisual.url || clientVisual;
    return Object.assign(clientVisual, {
        id,
        fitBehaviour: "fit",
        bgColor: "#FFFFFF",
        url,
        filename: url,
        sizeUrls: {
            bare: url,
            original: url
        },
        languageCodes: [],
        kind: VisualKind.IMAGE,
    });
}

// Uses the `baseVisual` settings instead of the store ones since the binder ones are more up to date
export function extendVisuals<T extends { id: string; startTimeMs?: number; endTimeMs?: number } & Partial<VisualSettings>>(baseVisuals: T[], storeVisuals: T[]): T[] {
    return baseVisuals.map(baseVisual => {
        const storeVisual = storeVisuals.find(v => v.id === baseVisual.id);

        if (!storeVisual) return baseVisual;

        // pick "startTimeMs" and "endTimeMs", and then pickBy to remove them if they are null or undefined
        // so we don't set any values that are null or undefined
        const chunkVideoTrimProperties = pickBy(v => v != null, pick(["startTimeMs", "endTimeMs"], baseVisual));

        // Creates a new object of the class of storeVisual, gives it the values of storeVisual, and overwrites all baseVisual properties
        return Object.assign(
            Object.create(Object.getPrototypeOf(storeVisual)),
            storeVisual,
            chunkVideoTrimProperties,
            extractVisualSettings(baseVisual),
        );
    });
}

const VISUAL_SETTINGS_NAMES = ["audioEnabled", "autoPlay", "bgColor", "fitBehaviour", "languageCodes", "rotation"];
/** Extracts only the visual settings that are non-nullable */
const extractVisualSettings = (binderVisual: Partial<VisualSettings>): Partial<VisualSettings> => {
    return Object.fromEntries(
        VISUAL_SETTINGS_NAMES
            .map(settingName => [settingName, binderVisual[settingName]])
            .filter(([_settingName, settingValue]) => settingValue != null)
    );
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const prepareVisualForAttach = (binderVisual: any): Record<string, any> => {
    return {
        ...pick(
            [
                "id",
                "fitBehaviour",
                "bgColor",
                "languageCodes",
                "audioEnabled",
                "autoPlay",
                "rotation"
            ],
            binderVisual
        ),
        url: binderVisual.kind === VisualKind.IMAGE ?
            binderVisual.sizeUrls.bare :
            binderVisual.sizeUrls.original
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const thumbnailToVisual = (thumbnail: any): any => {
    const id = extractIdFromUrl(thumbnail.medium);
    const visualFromStore = BinderMediaStoreActions.getVisual(id);
    const visualThumbnail = visualFromStore || Object.assign(thumbnail, {
        ...thumbnail,
        id: extractIdFromUrl(thumbnail.medium),
        url: thumbnail.medium,
        sizeUrls: { ...pick(Object.keys(ImageFormatType).filter(key => isNaN(parseInt(key, 10))).map(key => key.toLowerCase()), thumbnail) },
    });
    return Object.assign(
        Object.create(Object.getPrototypeOf(visualThumbnail)),
        visualThumbnail,
        extractVisualSettings(thumbnail),
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const combineVisuals = (visualsInBinder: any[], visualsFromService: any[]): any[] => {
    const inUseVisuals = [];
    for (const visualInBinder of visualsInBinder) {
        const serviceVisual = visualsFromService.find(visualFromService => visualInBinder.id === visualFromService.id || visualInBinder.id === visualFromService.originalVisualData?.originalId);
        if (!serviceVisual || inUseVisuals.some(v => v.id === serviceVisual.id)) {
            continue;
        }
        const combinedVisual = Object.assign(
            visualInBinder,
            serviceVisual,
            { inUse: true, id: serviceVisual.id, },
            extractVisualSettings(visualInBinder),
        );
        inUseVisuals.push(combinedVisual);
    }
    const unusedVisuals = visualsFromService
        .filter(visualFromService => visualsInBinder.find(visualInBinder => visualInBinder.id === visualFromService.id) === undefined)
        .map(image => Object.assign(image, { inUse: false }));
    unusedVisuals.sort(imageCmp);
    return [...inUseVisuals, ...unusedVisuals];
}

const getPreviewVisualUrl = (visualFile: File): string =>
    visualFile.type && visualFile.type.indexOf("video") >= 0 ?
        "//:0" :
        window.URL.createObjectURL(visualFile);

export const visualFileToPreviewVisual = (visualFile: File & { clientId: string }, positions: IVisualPosition[]): IPreviewVisual => {
    return {
        id: visualFile.clientId,
        filename: visualFile.name.split(".")[0],
        preview: true,
        url: getPreviewVisualUrl(visualFile),
        fitBehaviour: "fit" as unknown as FitBehaviour,
        bgColor: "#FFFFFF",
        positions,
        isUploading: true,
        percentUploaded: 0,
    };
}

const imageCmp = <T extends { filename: string }>(left: T, right: T): number => {
    if (left.filename && right.filename) {
        return left.filename.localeCompare(right.filename);
    }
    if (left.filename) {
        return -1;
    }
    if (right.filename) {
        return 1;
    }
    return 0;
}

export const buildImageChunksByImageId = <T extends { id: string }>(normalizedImagesChunks: T[][]): Record<string, {[chunkIndex: number]: number[]}> => {
    const chunksByImageId: Record<string, {[chunkIndex: number]: number[]}> = {};
    normalizedImagesChunks.forEach(
        (imageChunk, chunkIndex) => {
            imageChunk.forEach(
                (image, visualIndex) => {
                    if (!(image.id in chunksByImageId)) {
                        chunksByImageId[image.id] = {};
                    }
                    if (!(chunkIndex in chunksByImageId[image.id])) {
                        chunksByImageId[image.id][chunkIndex] = [];
                    }
                    chunksByImageId[image.id][chunkIndex].push(visualIndex);
                }
            )
        }
    );
    return chunksByImageId;
};

const flatUnique = (imageChunks) => {
    const result = [];
    const normalizedImagesChunks = imageChunks.map(
        imageChunk => imageChunk.map(toBinderVisual)
    );
    const chunksByImageId = buildImageChunksByImageId(normalizedImagesChunks);
    flatten(normalizedImagesChunks).reduce((reduced, visual) => {
        const key = visual.id;
        if (!(key in reduced)) {
            reduced[key] = 1;
            result.push(visual);
            return reduced;
        }
        return reduced;
    }, {});
    return result.map(
        image => (Object.assign(image, { chunks: (chunksByImageId[image.id] || []) }))
    );
}

export const thumbnailHasId = (thumbnail: Thumbnail, id: string): boolean => {
    const sizeKeys = Object.keys(ImageFormatType)
        .filter(key => isNaN(parseInt(key, 10)))
        .map(key => key.toLowerCase());
    for (const sizeKey of sizeKeys) {
        if (thumbnail[sizeKey] && thumbnail[sizeKey].indexOf(id) !== -1) {
            return true;
        }
    }
    return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function getDownloadOriginalUrl(visual: any, { forceDownload }: { forceDownload?: boolean } = {}): string {
    const isVideo = isVideoId(visual.id);
    let originalUrl = visual.urls?.original;
    if (!isVideo && !originalUrl) {
        originalUrl = toDifferentSizeVisualUrl(visual.url, "original");
    }
    originalUrl = buildTokenUrl(originalUrl, visual.urlToken);
    if (!isIE()) {
        const infix = (originalUrl && originalUrl.indexOf("?") > -1) ? "&" : "?";
        return forceDownload ? `${originalUrl}${infix}forceDownload=true` : originalUrl;
    }
    return originalUrl;
}

async function downloadFile(url: string, filename: string): Promise<void> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error - status: ${response.status}`);
        }
        const blob = await response.blob();
        FileSaver.saveAs(blob, filename);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Download failed", error);
    }
}

export async function downloadVisual(visual: Visual): Promise<void> {
    const url = getDownloadOriginalUrl(visual, { forceDownload: !isIE() });
    const filename = `${visual.filename}.${visual.extension}`;
    await downloadFile(url, filename);
}
