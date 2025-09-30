import { AncestorTree } from "@binders/client/lib/ancestors";
import { CollectionRepository } from "../repositories/collectionrepository";
import { splitEvery } from "ramda";

const SEARCH_MAX_RESULTS = 5000;
const SEARCH_OPTIONS = { maxResults: SEARCH_MAX_RESULTS };

export async function buildAncestorTree(collectionRepo: CollectionRepository, collectionId: string): Promise<AncestorTree> {
    const tree = new AncestorTree();
    const addCollections = async (allIds: string[]) => {
        if (allIds.length === 0) {
            return;
        }
        const idChunks = splitEvery(SEARCH_MAX_RESULTS, allIds);
        const childCollections = [];
        for (let i=0; i<idChunks.length; i++) {
            const newCollections = await collectionRepo.findCollections({ids: idChunks[i]}, SEARCH_OPTIONS);
            for (let j=0; j<newCollections.length; j++) {
                const collection = newCollections[j];
                tree.addCollectionByIds(collection.id, collection.elements.map(e => e.key));
                for (let k=0; k<collection.elements.length; k++) {
                    if (collection.elements[k].kind === "collection") {
                        childCollections.push(collection.elements[k].key)
                    }
                }
            }
        }
        return addCollections(childCollections);
    }
    await addCollections([collectionId]);
    return tree;
}

