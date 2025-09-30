import {
    Binder,
    BinderModules,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FEEDBACK_CHUNK_DATAPROP,
    READ_CONFIRMATION_CHUNK_DATAPROP,
    TITLE_CHUNK_DATAPROP
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { VisualKind } from "@binders/client/lib/clients/imageservice/v1/contract";
import manualToLogoBase64 from "../exportservice/pdf/manualToLogoBase64";

export async function prependTitleChunk(
    binderOrPublication: Binder | Publication,
    options: {
        totalVideoDurationSecs: number;
    }
): Promise<BinderModules> {
    return injectThumbnailImageChunk(
        binderOrPublication,
        [`<body ${TITLE_CHUNK_DATAPROP}="true" data-total-video-duration-secs="${options.totalVideoDurationSecs}"></body>`],
        { prepend: true }
    );
}

export function appendFeedbackChunk(binderData: BinderModules): Promise<BinderModules> {
    return appendManualToChunk(binderData, FEEDBACK_CHUNK_DATAPROP);
}

export function appendMadeByManualToChunk(
    binderData: BinderModules,
    shouldRenderAdditionalChunk = false,
    translatedText: string,
): Promise<BinderModules> {
    if (!shouldRenderAdditionalChunk) {
        return Promise.resolve(binderData);
    }
    return appendManualToChunk(binderData, translatedText)
}

export function appendReadConfirmationChunk(binderOrPublication: Binder | Publication,): Promise<BinderModules> {
    return injectThumbnailImageChunk(binderOrPublication, [`<body ${READ_CONFIRMATION_CHUNK_DATAPROP}="true"></body>`]);
}

function appendManualToChunk(
    binderData: BinderModules,
    translatedText: string,
): Promise<BinderModules> {
    const { text: oldText = { chunked: [] }, images: oldImages = { chunked: [] }, ...rest } = binderData;
    const { imagesCount, textCount } = {
        imagesCount: oldImages.chunked[0].chunks.length,
        textCount: oldText.chunked[0].chunks.length,
    };
    const imageUrl = manualToLogoBase64;
    const chunksCount = Math.max(imagesCount, textCount);
    const baseArray = new Array(chunksCount).fill([]);
    return Promise.resolve({
        ...rest,
        text: {
            ...oldText,
            chunked: oldText.chunked.map((module => ({
                ...module,
                chunks: [...Object.values({ ...baseArray, ...module.chunks }), [translatedText]],
            })))
        },
        images: {
            ...oldImages,
            chunked: oldImages.chunked.map(module => ({
                ...module,
                chunks: [...Object.values({ ...baseArray, ...module.chunks }), [Object.assign(Object.create(BinderVisual.prototype), {
                    id: "img-0",
                    fitBehaviour: "fit",
                    bgColor: "#FFCC00",
                    url: imageUrl,
                    filename: "manual.to-logo",
                    formatUrls: [{
                        width: 1200,
                        height: 1200,
                        url: imageUrl,
                        name: "ORIGINAL"
                    }],
                    languageCodes: [],
                    kind: VisualKind.IMAGE,
                })]]
            }))
        },
    });
}

function injectThumbnailImageChunk(
    binderOrPublication: Binder | Publication,
    chunkArray: string[],
    options = { prepend: false },
) {
    const { text: oldText = { chunked: [] }, images: oldImages = { chunked: [] }, ...rest } = binderOrPublication.modules;
    const { imagesCount, textCount } = {
        imagesCount: oldImages.chunked[0].chunks.length,
        textCount: oldText.chunked[0].chunks.length,
    };
    const chunksCount = Math.max(imagesCount, textCount);
    const baseArray = new Array(chunksCount).fill([]);
    const thumbnailImageChunk = binderOrPublication.thumbnail.id ?
        [Object.assign(Object.create(BinderVisual.prototype), { ...binderOrPublication.thumbnail })] :
        [];
    return Promise.resolve({
        ...rest,
        text: {
            ...oldText,
            chunked: oldText.chunked.map((module => ({
                ...module,
                chunks: [
                    ...(options.prepend ? [chunkArray] : []),
                    ...Object.values({ ...baseArray, ...module.chunks }),
                    ...(options.prepend ? [] : [chunkArray]),
                ],
            })))
        },
        images: {
            ...oldImages,
            chunked: oldImages.chunked.map(module => ({
                ...module,
                chunks: [
                    ...(options.prepend ? [thumbnailImageChunk] : []),
                    ...Object.values({ ...baseArray, ...module.chunks }),
                    ...(options.prepend ? [] : [thumbnailImageChunk]),
                ],
            }))
        },
    });
}


