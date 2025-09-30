import { hasAtLeastOneReadableParentPath } from "@binders/client/lib/ancestors";
import { intersection } from "ramda";

const getParentPathFromUri = (parentPathFromUri, readableItems) => {
    const parentCollectionId = parentPathFromUri[parentPathFromUri.length - 1]
    if(readableItems.some(id => id === parentCollectionId)) {
        // the direct parent from the parent path in uri is readable, return full path
        return parentPathFromUri;
    }
    // direct parent from parent path in uri is not readable, pick first of readable items
    return readableItems.slice(0, 1);
}

const composeParentPathFromReadableItems = (readableItems, parentPathFromUri) => {
    if(parentPathFromUri && parentPathFromUri.length > 0) {
        // there's a parent path with collectionId's in the uri
        return getParentPathFromUri(parentPathFromUri, readableItems);
    }
    // no indication as to which readable parents to use, pick first
    return readableItems.slice(0, 1);
}

const getReadableDirectParents = (itemId, ancestors, readableItems) => {
    const parentIdCandidates = ancestors[itemId] || [];
    return parentIdCandidates.filter(parentIdCandidate => hasAtLeastOneReadableParentPath(ancestors, [parentIdCandidate], [], readableItems));
}

// readableItems include the user's resourceGroups and the public resourceGroups
// landingPageItems are the summaries and collections we see on the landing page, a.k.a. the "items" in the binder store
export const composeParentPath = (itemId, ancestors, parentPathFromUri, readableItems, landingPageItems, lastBrowsedParentId) => {
    // first, check if there's a lastBrowsedParentId, this should get priority
    if(lastBrowsedParentId) {
        if([...parentPathFromUri].pop() === lastBrowsedParentId) {
            return parentPathFromUri; // return parent path from url if it ends with the lastBrowsedParentId
        }
        return [lastBrowsedParentId];
    }
    // if not, let's consider the ancestor tree of the itemId, and filter out the ones we don't have read access to
    const readableAncestors = intersection(Object.keys(ancestors), readableItems).filter(a => a !== itemId);
    if(readableAncestors.length > 0) {
        // take the direct readable parents
        const readableParents = getReadableDirectParents(itemId, ancestors, readableItems);
        if(readableParents && readableParents.length > 0) {
            // at least 1 direct readable parent found
            return composeParentPathFromReadableItems(readableParents, parentPathFromUri);
        }
        // we have readableItems but not among the ancestors of this item, parent is "/browse"
        return [""];
    }
    // no readable ancestors within item tree, let's look at the landingpage items
    if(landingPageItems.length === 0 || (landingPageItems.length === 1 && landingPageItems[0].id === itemId)) {
        // we have access to nothing (or ONLY the item we're investigating), return no parents
        return [];
    }
    // no readable ancestors within item tree, but there are readable items on the landing page, parent is "/browse"
    return [""];
}
