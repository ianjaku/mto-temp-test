import {
    Binder,
    BinderSearchHit,
    CollectionSearchHit,
    DocumentAncestors,
    DocumentCollection,
    HitType,
    IBinderStory,
    IThumbnail,
    Item,
    ItemBatchFilterProcess,
    ItemFilterProcess,
    Language,
    MTEngineType,
    Owner,
    Publication,
    PublicationSearchHit
} from "./contract";
import { User, Usergroup } from "../../userservice/v1/contract";
import { flatten, pick } from "ramda";
import BinderClass from "../../../binders/custom/class";
import { TranslationKeys } from "../../../i18n/translations";
import i18next from "../../../i18n";
import { isPublicationItem } from "./validation";
import { isUsergroup } from "../../userservice/v1/helpers";

export const SEARCH_QUERY_LANGUAGE_OPTION_REGEX = /lang:[a-zA-Z]+-?([a-zA-Z]+)?/gi;
export const FEEDBACK_CHUNK_DATAPROP = "data-mtfeedback";
export const MANUALTO_CHUNK_DATAPROP = "data-mtchunk";
export const TITLE_CHUNK_DATAPROP = "data-mttitle";
export const HIDDEN_CHUNK_DATAPROP = "data-hidden";
export const READ_CONFIRMATION_CHUNK_DATAPROP = "data-mtreadconfirmation";

export const getBinderLanguages = (binder: Binder): Language[] => {
    const languages = binder.languages.map(l => {
        const isDeleted = binder.modules?.meta?.find(m => m.iso639_1 === l.iso639_1)?.isDeleted;
        return { ...l, isDeleted };
    });
    return languages.sort(({ priority: p1 }, { priority: p2 }) => p1 - p2);
};

export const getBinderMasterLanguage = (binder: Binder): Language => {
    const visibleLanguages = getBinderLanguages(binder).filter(l => !l.isDeleted);
    return visibleLanguages[0];
};

/**
 * @deprecated use {@link isCollectionItem} instead
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export function isCollection(item: any): item is DocumentCollection {
    return item.kind === "collection" || item.titles;
}

export function extractTitleForLanguage(item: DocumentCollection | Binder, languageCode: string): string {
    if (isCollection(item)) {
        return (item as DocumentCollection).titles.find(t => t.languageCode === languageCode)?.title;
    }
    return (item as Binder).languages.find(language => language.iso639_1 === languageCode)?.storyTitle;
}

export const extractTitleAndLanguage = (item: DocumentCollection | Binder): { title: string, language: string } => {
    if (isCollection(item)) {
        return {
            title: item.titles[0].title,
            language: item.titles[0].languageCode
        }
    }
    const masterLanguage = getBinderMasterLanguage(item);
    if (masterLanguage) {
        const title = masterLanguage.storyTitle || i18next.t(TranslationKeys.DocManagement_DocNew);
        const language = masterLanguage.iso639_1 || "xx";
        return { title, language };
    }
    return { title: "", language: "xx" };
}

export const extractTitle = (item: DocumentCollection | Binder): string => {
    const { title } = extractTitleAndLanguage(item);
    return title;
}

export async function applyItemFilters<T>(itemFilterFunctions: ItemFilterProcess<T>[], item: T): Promise<boolean> {
    for (const itemFilterFunction of itemFilterFunctions) {
        if (!(await itemFilterFunction(item))) {
            return false;
        }
    }
    return true;
}

export async function applyBatchItemFilters<T>(itemFilterFunctions: ItemBatchFilterProcess<T>[], items: T[]): Promise<T[]> {
    let filteredItems = items;
    for (const itemFilterFunction of itemFilterFunctions) {
        filteredItems = await itemFilterFunction(filteredItems);
    }
    return filteredItems;
}


export function idOfSearchHit(hit: HitType): string {
    if (hit["binderSummary"]) {
        return (hit as BinderSearchHit).binderSummary.id;
    }
    if (hit["collection"]) {
        return (hit as CollectionSearchHit).collection.id;
    }
    return (hit as PublicationSearchHit).publicationSummary.id;
}

export function getMTEngineName(type: MTEngineType): string {
    if (type === undefined) {
        return undefined;
    }
    return {
        [MTEngineType.Azure]: "Azure",
        [MTEngineType.Google]: "Google",
        [MTEngineType.Deepl]: "Deepl",
    }[type];
}

export function chunkIdFromIndex(binder: BinderClass, index: number): string {
    const binderLog = binder.getBinderLog();
    return index == -1 ?
        binder.id : // title chunks have a binderLog entry with uuid === binderId
        binderLog.current.find(log => log.position === index)?.uuid;
}

export function toBinderStories(publications: Publication[]): IBinderStory[] {
    const emptyBinderSummary = (publication: Publication) => {
        return {
            id: publication.binderId,
            thumbnail: publication.thumbnail,
            languages: [],
            publicationIds: [],
            isMaster: publication.isMaster
        } as IBinderStory;
    };
    const binderSummaryMap = publications.reduce((reduced, publication) => {
        const binderSoFar = reduced.get(publication.binderId);
        const toUpdate: IBinderStory = binderSoFar ? binderSoFar : emptyBinderSummary(publication);
        if (!(toUpdate.languages.map(l => l.iso639_1).includes(publication.language.iso639_1))) {
            toUpdate.languages = publication.isMaster ?
                [publication.language, ...toUpdate.languages] :
                [...toUpdate.languages, publication.language];
            toUpdate.publicationIds = publication.isMaster ?
                [publication.id, ...toUpdate.publicationIds] :
                [...toUpdate.publicationIds, publication.id];
        }
        return reduced.set(publication.binderId, toUpdate);
    }, new Map<string, IBinderStory>());
    return Array.from(binderSummaryMap.values());
}

export function sortLanguagesUsed(collection: DocumentCollection, languagesUsed: string[]): string[] {
    const result = [];
    if (collection.titles && collection.titles.length > 1) {
        collection.titles.forEach(title => {
            if (languagesUsed.indexOf(title.languageCode) > -1) {
                result.push(title.languageCode);
            }
        });
    }
    languagesUsed.forEach(langCode => {
        if (result.indexOf(langCode) === -1) {
            result.push(langCode);
        }
    });
    return result;
}

export const countBinderChunks = (binder: Binder): number => {
    return binder.binderLog.current.length;
}

/**
 * @returns all parents of the given itemId (!Does not include the itemId itself!)
 *          ordered from closest to furthest, with the root collection being the last element
 */
export const getAllParentsFromDocumentAncestors = (
    itemId: string,
    ancestors: DocumentAncestors
): string[] => {
    const parents = ancestors[itemId];
    if (parents == null) return [];
    const grandParents = parents.map(parent => getAllParentsFromDocumentAncestors(parent, ancestors));
    return Array.from(new Set<string>(flatten([parents, grandParents])));
}

export function getBinderLastModifiedDate(binder: Binder): Date {
    const result = binder.modules.meta
        .map(m => m.lastModifiedDate)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    const resultDate = new Date(result);
    if (isNaN(resultDate.getTime())) {
        return binder.lastModified;
    }
    return resultDate;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function visualToThumbnail(binderVisual): IThumbnail {
    return {
        ...pick(["fitBehaviour", "bgColor", "rotation"], binderVisual),
        ...binderVisual.sizeUrls,
        medium: binderVisual.buildRenderUrl({ requestedFormatNames: ["medium"] }),
    };
}

export function isBinderId(id: string): boolean {
    return id.length === 20;
}

export function userOrGroupAsOwner(userOrGroup: User | Usergroup): Owner {
    if (isUsergroup(userOrGroup)) {
        return {
            id: userOrGroup.id,
            name: userOrGroup.name,
        };
    } else {
        return {
            id: userOrGroup.id,
            name: userOrGroup.displayName,
            login: userOrGroup.login
        };
    }
}

export function getBinderIdFromItem(item: Item): string {
    if (isPublicationItem(item) && item.binderId) {
        return item.binderId;
    }
    return item.id;
}