import { toFullPath, withoutPathPrefix } from "../util";

export const READERS_SCOPE = "readerScope";

export function buildNestedCollectionsPath(parentCollection, itemId, prefix) {
    const path = withoutPathPrefix(window.location.pathname);
    let parentCollectionId = parentCollection ? parentCollection.id : undefined;
    if (parentCollection === undefined) {
        const pathParts = path.split("/").slice(2, path.length);
        parentCollectionId = pathParts[pathParts.length - 1];
    }

    if (path !== toFullPath("/search") && parentCollectionId) {
        let startIndex, endIndex;
        const browseIndex = path.indexOf("browse");
        if (browseIndex > -1) {
            startIndex = path.indexOf("/", browseIndex) + 1;
            endIndex = path.length;
        } else {
            const launchIndex = path.indexOf("launch");
            const readIndex = path.indexOf("read")
            const index = readIndex > - 1 ? readIndex : launchIndex;
            startIndex = path.indexOf("/", index) + 1;
            endIndex = path.lastIndexOf("/");
        }

        let collectionIdsPath = path.substring(startIndex, endIndex);
        if (collectionIdsPath.indexOf(parentCollectionId) === -1) {
            /* eslint-disable no-console */
            console.error(
                `failed to build nested collection path, parent collection id ${parentCollectionId} not in path ${path}`
            );
            /* eslint-enable no-console */
            return toFullPath(`/${prefix}/${itemId}`);
        }
        collectionIdsPath = collectionIdsPath.replace(parentCollectionId, `${parentCollectionId}/${itemId}`);
        return toFullPath(`/${prefix}/${collectionIdsPath}`);
    }
    return toFullPath(`/${prefix}/${itemId}`);
}


