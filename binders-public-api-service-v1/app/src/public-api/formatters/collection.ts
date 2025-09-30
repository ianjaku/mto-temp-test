import { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FitBehavior,
    PublicCollection,
    PublicCollectionItem,
    PublicItemTitles,
    VisualChunk 
} from "@binders/client/lib/clients/publicapiservice/v1/contract";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { Visual as VisualFormatter } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { extractIdFromUrl } from "@binders/client/lib/clients/imageservice/v1/visuals";

async function collectionFormatter (
    collection: DocumentCollection,
    visuals: Visual[],
    elements: Array<Binder | DocumentCollection>,
    getVisualFromImageService: () => Promise<Visual>,
): Promise<PublicCollection> {
    const { id } = collection;
    return {
        id,
        coverVisual: await buildPublicCollectionCoverVisual(collection, visuals, getVisualFromImageService),
        titles: buildPublicCollectionTitles(collection),
        items: buildCollectionItems(elements),
    };
}

async function buildPublicCollectionCoverVisual(
    collection: DocumentCollection,
    visuals: Visual[],
    getVisualFromImageService: () => Promise<Visual>
): Promise<VisualChunk> {
    const { bgColor, fitBehaviour } = collection.thumbnail;
    const id = extractIdFromUrl(collection.thumbnail.medium);
    let visual = visuals.find(v => v.id === id);
    if (!visual) {
        visual = await getVisualFromImageService();
    }
    if (!visual) {
        return {
            id: "default-cover-image",
            bgColor,
            fitBehavior: fitBehaviour as FitBehavior,
            mime: "image/png",
            url: DEFAULT_COVER_IMAGE,
        }
    }
    const formattedVisual = Object.assign(VisualFormatter.prototype, visual);
    return {
        id,
        bgColor,
        fitBehavior: fitBehaviour as FitBehavior,
        mime: visual.mime,
        url: formattedVisual.buildRenderUrl(),
    };
}

function buildPublicCollectionTitles(collection: DocumentCollection): PublicItemTitles {
    const { titles } = collection;
    const itemTitles = {} as PublicItemTitles;
    titles.forEach(itemTitle => {
        itemTitles[itemTitle.languageCode] = itemTitle.title;
    });
    return itemTitles;
}

function buildDocumentTitles(binder: Binder): PublicItemTitles {
    const { languages } = binder;
    const itemTitles = {} as PublicItemTitles;
    languages.forEach(lang => {
        itemTitles[lang.iso639_1] = lang.storyTitle;
    });
    return itemTitles;
}

function buildCollectionItems(elements: Array<Binder|DocumentCollection>): PublicCollectionItem[] {
    return elements.map(element => {
        const isCollection = element["kind"] === "collection";
        return {
            id: element.id,
            kind: isCollection ? "collection" : "document",
            titles: isCollection ?
                buildPublicCollectionTitles(<DocumentCollection>element) :
                buildDocumentTitles(<Binder>element),
        };
    });
}

export default collectionFormatter;