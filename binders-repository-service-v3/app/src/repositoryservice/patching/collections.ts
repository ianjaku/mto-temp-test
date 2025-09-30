import * as Immutable from "immutable";
import { CollectionElement, CollectionTitle, DocumentCollection, IThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/contract.d";
import { CollectionLastTitle } from "../model";
import { InvalidOperation } from "@binders/client/lib/util/errors";
import { Ownership } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { curry } from "ramda";

export const isSameElement = curry((el1: CollectionElement, el2: CollectionElement): boolean => {
    return el1.key === el2.key && el1.kind === el2.kind;
});

export const recoverCollection = (collection: DocumentCollection): DocumentCollection => {
    return {
        ...collection,
        deletionTime: null
    };
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const addCollectionElement = (collection: DocumentCollection, kind: string, key: string) => {
    const newElement = Immutable.Map({ key, kind });
    const currentImmutable = Immutable.fromJS(collection);
    let elements = currentImmutable.get("elements");
    if (!elements.find(elem => elem.kind === kind && elem.key === key)) {
        elements = elements.push(newElement);
    }
    const collectionWithElement = currentImmutable.set("elements", elements).toJS();
    // Remove the element from the deleted elements, if it exists
    return removeDeletedElement(collectionWithElement, kind, key);
};

export const removeDeletedElement = (
    collection: DocumentCollection,
    kind: string,
    key: string
): DocumentCollection => {
    const currentImmutable = Immutable.fromJS(collection);
    let deletedElements = currentImmutable.get(
        "deletedElements",
        Immutable.List<CollectionElement>()
    );
    deletedElements = deletedElements.filter(
        el => !(el.get("key") === key && el.get("kind") === kind)
    );
    return currentImmutable
        .set("deletedElements", deletedElements)
        .toJS();
}

export const removeCollectionElement = (
    collection: DocumentCollection,
    kind: string,
    key: string,
    permanent = false
): DocumentCollection => {
    const currentImmutable = Immutable.fromJS(collection);
    let elements: Immutable.List<Immutable.Map<string, unknown>> = currentImmutable.get("elements", Immutable.List<CollectionElement>());
    let deletedElements: Immutable.List<Immutable.Map<string, unknown>> = currentImmutable.get("deletedElements", Immutable.List<CollectionElement>());

    const isElementToRemove = (element: Immutable.Map<string, unknown>): boolean =>
        element.get("kind") === kind && element.get("key") === key;

    const element = elements.find(isElementToRemove);
    const deletedElement = deletedElements.find(isElementToRemove);
    const removedElement = element ?? deletedElement;

    elements = elements.filterNot(isElementToRemove) as Immutable.List<Immutable.Map<string, unknown>>;
    deletedElements = deletedElements.filterNot(isElementToRemove) as Immutable.List<Immutable.Map<string, unknown>>;
    if (!permanent && removedElement) {
        deletedElements = deletedElements.push(removedElement);
    }

    return currentImmutable
        .set("deletedElements", deletedElements)
        .set("elements", elements)
        .toJS();
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const changeCollectionElementPosition = (collection: DocumentCollection, kind: string, key: string, newPosition: number) => {
    const currentImmutable = Immutable.fromJS(collection);
    const currentElements = currentImmutable.get("elements");
    const currentIndex = currentElements.findIndex(elem => elem.get("kind") === kind && elem.get("key") === key);
    if (currentIndex === -1) {
        throw new InvalidOperation(`Collection element not found {key: ${key}, kind: ${kind}}`);
    }
    if (newPosition > collection.elements.length) {
        throw new InvalidOperation(`Invalid offset in element list: ${newPosition} >= ${collection.elements.length}`);
    }
    const updatedElements = currentElements
        .delete(currentIndex)
        .insert(newPosition, Immutable.Map({ key, kind }));
    return currentImmutable.set("elements", updatedElements).toJS();
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const updateLanguageTitle = (
    collection: DocumentCollection,
    currentLanguageCode: string,
    languageCode: string
) => {
    const currentImmutable = Immutable.fromJS(collection);
    const currentTitles = currentImmutable.get("titles");
    const currentLanguageIndex = currentTitles.findIndex(t => t.get("languageCode") === currentLanguageCode);
    const updatedTitles = currentTitles.set(currentLanguageIndex, Immutable.Map({
        ...currentTitles.get(currentLanguageIndex).toJS(),
        languageCode,
    }));
    return currentImmutable.set("titles", updatedTitles).toJS();
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const setTitle = (collection: DocumentCollection, languageCode: string, title: string) => {
    const currentImmutable = Immutable.fromJS(collection);
    const currentTitles = currentImmutable.get("titles");
    const isUndefinedLang = currentTitles.findIndex(t => t.get("languageCode") === UNDEFINED_LANG);
    const currentLanguageIndex = currentTitles.findIndex(t => t.get("languageCode") === languageCode);
    let updatedTitles;
    if (currentLanguageIndex === -1) {
        updatedTitles = currentTitles.push(Immutable.Map({ languageCode, title }));
    }
    else {
        updatedTitles = currentTitles.set(currentLanguageIndex, Immutable.Map({ languageCode, title }));
    }
    if (isUndefinedLang >= 0 && updatedTitles.size > 1) {
        updatedTitles = updatedTitles.delete(isUndefinedLang);
    }
    return currentImmutable.set("titles", updatedTitles).toJS();
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const removeCollectionTitle = (collection: DocumentCollection, languageCode: string) => {
    const currentImmutable = Immutable.fromJS(collection);
    const currentTitles = currentImmutable.get("titles") as Immutable.List<Immutable.Map<string, string>>;
    if (currentTitles.size === 1) {
        throw new CollectionLastTitle(collection.id);
    }
    const currentLanguageIndex = currentTitles.findIndex(t => t.get("languageCode") === languageCode);
    if (currentLanguageIndex > -1) {
        const updatedTitles = currentTitles.delete(currentLanguageIndex);
        return currentImmutable.set("titles", updatedTitles).toJS();
    }
    return currentImmutable.toJS();
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const updateThumbnail = (collection: DocumentCollection, thumbnail: IThumbnail) => {
    const currentImmutable = Immutable.fromJS(collection);
    return currentImmutable.set("thumbnail", thumbnail).toJS();
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const updateIsHidden = (collection: DocumentCollection, isHidden: boolean) => {
    const currentImmutable = Immutable.fromJS(collection);
    return currentImmutable.set("isHidden", isHidden).toJS();
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const updateShowInOverview = (collection: DocumentCollection, showInOverview: boolean) => {
    const currentImmutable = Immutable.fromJS(collection);
    return currentImmutable.set("showInOverview", showInOverview).toJS();
};

export const updateOwnership = (collection: DocumentCollection, ownership: Ownership): DocumentCollection => {
    const current = Immutable.fromJS(collection);
    return current.set("ownership", ownership).toJS();
}

export const createNewCollection = (
    accountId: string,
    title: CollectionTitle,
    thumbnail: IThumbnail,
    isRootCollection: boolean,
    domainCollectionId: string,
): DocumentCollection => {
    const now = new Date();
    return {
        accountId,
        elements: [],
        titles: [title],
        thumbnail,
        isRootCollection,
        created: now,
        lastModified: now,
        domainCollectionId,
        isHidden: false,
        hasPublications: false,
    };
};