import {
    BindersImageModule,
    BindersTextModule,
    IThumbnail,
    Publication 
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FitBehavior,
    PublicPublication,
    ViewPortDimensions,
    VisualChunk 
} from "@binders/client/lib/clients/publicapiservice/v1/contract";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { Visual as VisualFormatter } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { extractIdFromUrl } from "@binders/client/lib/clients/imageservice/v1/visuals";

function publicationFormatter(
    publication: Publication,
    format: "html" | "richtext" = "html",
    visuals: Visual[],
    dimensions: ViewPortDimensions,
): PublicPublication {
    const isHtml = format === "html";
    const { binderId, id, modules, thumbnail } = publication;
    return {
        id,
        documentId: binderId,
        languageCode: getPublicationLanguageCode(publication),
        title: getPublicationTitle(publication),
        coverVisual: buildPublicVisualFromThumbnail(thumbnail, visuals),
        textChunks: isHtml ? buildHtmlChunks(modules.text) : buildRichTextChunks(modules.text),
        visualChunks: buildVisualChunks(modules.images, visuals, dimensions),
    };
}

function getPublicationLanguageCode(publication: Publication): string {
    return publication.language ? publication.language.iso639_1 || "xx" : "xx";
}

function getPublicationTitle(publication: Publication): string {
    return publication.language ? publication.language.storyTitle : "Empty title";
}

function buildPublicVisualFromThumbnail(thumbnail: IThumbnail, visuals: Visual[]): VisualChunk {
    const { bgColor, fitBehaviour } = thumbnail;
    const id = extractIdFromUrl(thumbnail.medium);
    const visual = visuals.find(v => hasMatchingBinderVisualId(v, id));
    const formattedVisual = Object.assign(VisualFormatter.prototype, visual);
    return {
        id,
        bgColor,
        fitBehavior: fitBehaviour as FitBehavior,
        mime: (visual && visual.mime),
        url: formattedVisual.buildRenderUrl(),
    };
}

function buildHtmlChunks(textModule: BindersTextModule) {
    const result = [];
    textModule.chunked[0].chunks.forEach(chunked => {
        result.push({
            content: chunked.join("")
        })
    });
    return result;
}

function buildRichTextChunks(textModule: BindersTextModule) {
    const { editorStates } = textModule.chunked[0];
    return editorStates.map(editorState => ({
        content: editorState.replace(/\\/g, ""),
    }));
}

function hasMatchingBinderVisualId(visual: Visual, binderVisualId: string) {
    return (
        visual.id === binderVisualId ||
        visual.idFromStorageLocation === binderVisualId
    );
}

function buildVisualChunks(
    imageModule: BindersImageModule,
    visuals: Visual[],
    dimensions: ViewPortDimensions,
): VisualChunk[][] {
    const result = [];
    imageModule.chunked[0].chunks.forEach((binderVisuals, i) => {
        result[i] = [];
        binderVisuals.forEach(binderVisual => {
            let visual = visuals.find(v => hasMatchingBinderVisualId(v, binderVisual.id));
            if (!visual) {
                // eslint-disable-next-line no-console
                console.log(`Could not find visual for ${binderVisual.id}`);
                // eslint-disable-next-line no-console
                console.log(JSON.stringify(visuals, null, 4));
                visual = (binderVisual as Visual);
            }
            result[i].push(buildVisual(visual, dimensions));
        });
    });
    return result;
}

function buildVisual(visual: Visual, dimensions: ViewPortDimensions): VisualChunk {
    const formattedVisual = Object.assign(VisualFormatter.prototype, visual);
    const mime = (visual.mime && visual.mime.startsWith("video")) ?
        "video/mp4" :
        visual.mime;
    return {
        id: visual.id,
        bgColor: visual.bgColor,
        fitBehavior: visual.fitBehaviour as FitBehavior,
        mime,
        url: formattedVisual.buildRenderUrl({
            bestFitOptions: {
                isLandscape: dimensions.height < dimensions.width,
                viewportDims: dimensions,
            }
        }),
    };
}

export default publicationFormatter;