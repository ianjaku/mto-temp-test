import { AccountSortMethod } from "../clients/accountservice/v1/contract";
import { Item } from "../clients/repositoryservice/v3/contract";
import { extractTitle } from "../clients/repositoryservice/v3/helpers";
import { isCollectionItem } from "../clients/repositoryservice/v3/validation";

const sortByTitleAlphabetically = <T>(items: T[], extractTitle: (i: T) => string): T[] => {
    return [...items].sort((left, right) => {
        const titleLeft = extractTitle(left);
        const titleRight = extractTitle(right);
        return titleLeft.localeCompare(titleRight);
    });
};

const sortByTitleNumerically = <T>(items: T[], extractTitle: (i: T) => string): T[] => {
    return [...items].sort((left, right) => {
        const titleLeft = extractTitle(left);
        const titleRight = extractTitle(right);

        const numberA = parseInt(titleLeft.match(/^\d+/)?.shift());
        const numberB = parseInt(titleRight.match(/^\d+/)?.shift());

        if (numberA === numberB) {
            return titleLeft.localeCompare(titleRight);
        }
        if (isNaN(numberA)) {
            return 1;
        } else if (isNaN(numberB)) {
            return -1;
        } else {
            return numberA - numberB;
        }
    });
};

const sortByTypeCollectionFirst = <T>(items: T[], isCollection: (i: T) => boolean): T[] => {
    return [...items].sort((left, right) => {
        if (isCollection(left)) {
            return -1;
        } else if (isCollection(right)) {
            return 1;
        } else {
            return 0;
        }
    })
};

const sort = <T>(items: T[], sortMethod: AccountSortMethod, extractTitle: (i: T) => string, isCollection: (i: T) => boolean): T[] => {
    if (items == null) {
        return items;
    }
    switch (sortMethod) {
        case AccountSortMethod.CollectionsFirst:
            return sortByTypeCollectionFirst(items, isCollection);
        case AccountSortMethod.Numerical:
            return sortByTitleNumerically(items, extractTitle);
        case AccountSortMethod.None:
            return items;
        case AccountSortMethod.Alphabetical:
        default:
            return sortByTitleAlphabetically(items, extractTitle);
    }
};

export const sortItems = (items: Item[], sortMethod: AccountSortMethod): Item[] => {
    return sort(items, sortMethod, extractTitle, isCollectionItem);
};


export type IStoryTile = {
    title: string,
    kind: "document" | "summary" | "collection" | "collectionsummary",
}

export const sortStoryTiles = <S extends IStoryTile = IStoryTile>(
    storyTiles: S[],
    sortMethod: AccountSortMethod
): S[] => {
    const collectionKinds = [ "collection", "collectionsummary" ];
    return sort(
        storyTiles,
        sortMethod,
        storyTile => storyTile.title,
        storyTile => collectionKinds.includes(storyTile.kind),
    );
};
