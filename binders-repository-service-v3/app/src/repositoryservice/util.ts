import {
    Binder,
    BinderFindResult,
    CollectionElement,
    DocumentCollection,
    IDescendantsMap,
    Story
} from "@binders/client/lib/clients/repositoryservice/v3/contract";

export function sequential<T>(f: (item: T) => Promise<void>, items: Array<T>): Promise<void> {
    return items.reduce(async (reduced, item) => {
        await reduced;
        return f(item);
    }, Promise.resolve());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onlyEmptyArrays(array: any[]): boolean {
    return Array.isArray(array) && array.every(onlyEmptyArrays);
}


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getBinderTitleMap(binders: Binder[]) {
    return binders.reduce((prev, binder) => {
        const masterLanguage = getBinderMasterLanguage(binder);
        return { ...prev, [binder.id]: masterLanguage?.storyTitle }
    }, {});
}


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getCollectionTitleMap(collections: DocumentCollection[]) {
    return collections.reduce((prev, collection) => {
        const title = collection.titles[0].title
        return { ...prev, [collection.id]: title }
    }, {});
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getBinderMasterLanguage(binder: Binder | BinderFindResult) {
    const languagesByPriority = binder.languages
        .filter(lang => {
            const correspondingMetaModules = binder.modules.meta.filter(m => m.iso639_1 === lang.iso639_1)
            return (!correspondingMetaModules[0]) || (correspondingMetaModules[0].isDeleted !== true)
        })
        .sort(({ priority: p1 }, { priority: p2 }) => p1 - p2);
    return languagesByPriority.length > 0 && languagesByPriority[0];
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function idsFromDescendantsMap(descendantsMap: IDescendantsMap, kind?: string) {
    const descendantEls = Object.keys(descendantsMap).reduce((acc, lvl) => [...acc, ...descendantsMap[lvl]], []);
    if (kind) {
        return descendantEls.filter(el => el.kind === kind).map(el => el.key as string);
    }
    return descendantEls.map(el => el.key as string);
}

export function toOriginalSortOrder(publicationSummaries: Story[], elements: CollectionElement[]): Story[] {
    return elements.reduce((reduced, element) => {
        reduced.push(...publicationSummaries.filter(ps => ps.id === element.key));
        return reduced;
    }, [] as Story[]);
}
