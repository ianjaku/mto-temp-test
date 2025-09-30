import { Ancestors } from "./ancestors";
import { DocumentAncestors } from "../clients/repositoryservice/v3/contract";

export const hasAtLeastOneVisibleParentPath = (ancestors: Ancestors, itemsToExplore: string[], itemsExplored: string[]): boolean => {
    if (itemsToExplore.length === 0) {
        // No candidates left
        return false;
    }
    // Take a new candidate removing it from the items needing exploration
    const candidate = itemsToExplore.shift();
    if (itemsExplored.indexOf(candidate) > -1) {
        // candidate is already explored
        return hasAtLeastOneVisibleParentPath(ancestors, itemsToExplore, itemsExplored);
    }
    const candidateItems = ancestors.get(candidate);
    if (Array.isArray(candidateItems) && candidateItems.length === 0) {
        // We found a top level element (empty parent array), so we have a visible path
        return true;
    }
    const visibleItems = candidateItems.filter(i => !i.isHidden);
    if (visibleItems.length > 0) {
        // Add visible parents to items that need exploration
        itemsToExplore.push(...(visibleItems.map(item => item.id)));
    }
    // Mark candidate as done
    itemsExplored.push(candidate);
    // Have another go
    return hasAtLeastOneVisibleParentPath(ancestors, itemsToExplore, itemsExplored);
};

export const hasAtLeastOneReadableParentPath = (
    ancestors: DocumentAncestors,
    itemsToExplore: string[],
    itemsExplored: string[],
    readableItems: string[]
): boolean => {
    if (readableItems.length === 0) {
        return false;
    }
    return !!getClosestAncestorMatch(ancestors, itemsToExplore, itemsExplored,
        candidate => readableItems.some(id => candidate === id),
    );
};

export const getClosestAncestorMatch = (
    ancestors: DocumentAncestors,
    itemsToExplore: string[],
    itemsExplored: string[],
    predicate: (candidate: string) => boolean,
): string | undefined => {
    if (itemsToExplore.length === 0) {
        // No candidates left
        return undefined;
    }
    // Take a new candidate removing it from the items needing exploration
    const candidate = itemsToExplore.shift();

    if (predicate(candidate)) {
        // We found a match
        return candidate;
    }
    if (itemsExplored.indexOf(candidate) > -1) {
        // candidate is already explored
        return getClosestAncestorMatch(ancestors, itemsToExplore, itemsExplored, predicate);
    }
    const candidateItems = ancestors[candidate];
    if (candidateItems.length > 0) {
        // Add visible parents to items that need exploration
        itemsToExplore.push(...candidateItems);
    }
    // Mark candidate as done
    itemsExplored.push(candidate);
    // Have another go
    return getClosestAncestorMatch(ancestors, itemsToExplore, itemsExplored, predicate);
};

const getIdFromParentCollectionSummary = (parentCollectionSummary) => {
    return parentCollectionSummary
        .map(({ id }) => id)
        .join("");
}

const getIdFromParentCollectionSummaries = (parentCollectionSummaries) => {
    if (parentCollectionSummaries.length == 0) {
        return "root";
    }
    return parentCollectionSummaries
        .map(getIdFromParentCollectionSummary)
        .join("-");
}


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCommonHitMap(elements, takeItemFunction, renderFunction) {
    return elements.reduce((partialResult, hit, index) => {
        const item = takeItemFunction(hit);
        const renderItem = renderFunction(hit, index);
        const parentCollectionSummaries = item.parentCollectionSummaries ?? [];
        const id = getIdFromParentCollectionSummaries(parentCollectionSummaries);
        partialResult[id] = partialResult[id] ?
            [...partialResult[id], { renderItem, parentCollectionSummaries }] :
            [{ renderItem, parentCollectionSummaries }];
        return partialResult;
    }, {});
}


export function buildAncestorsList(itemId: string, ancestors: DocumentAncestors): string[] {
    if (ancestors[itemId].length === 0 || ancestors[itemId] === undefined) {
        return [];
    }
    return [ancestors[itemId][0], ...buildAncestorsList(ancestors[itemId][0], ancestors)];
}

export function buildAncestorsObject(itemIds: string[], ancestors: DocumentAncestors): Record<string, string[]> {
    const ancestorObject = itemIds.reduce((obj, el) => ({ [el]: buildAncestorsList(el, ancestors), ...obj }), {});
    return ancestorObject;
}

function getAllPathsToRoot(ancestors: DocumentAncestors, pathsSoFar: string[][]): string[][] {
    let isComplete = true;
    const total = pathsSoFar.length;
    for (let i = 0; i < total; i++) {
        const path = pathsSoFar[i];
        const toProcess = path[0];
        const directParents = ancestors[toProcess] ?? [];
        if (directParents.length === 0) {
            continue;
        }
        isComplete = false;
        pathsSoFar[i] = [directParents[0], ...path];
        for (let j = 1; j < directParents.length; j++) {
            const newPath = [directParents[j], ...path];
            pathsSoFar.push(newPath);
        }
    }
    if (isComplete) {
        return pathsSoFar;
    }
    return getAllPathsToRoot(ancestors, pathsSoFar);
}

export function getAllPathsToRootCollection(itemId: string, ancestors: DocumentAncestors): string[][] {
    return getAllPathsToRoot(ancestors, [[itemId]]);
}