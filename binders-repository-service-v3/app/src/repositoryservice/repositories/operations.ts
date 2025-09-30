import { BindersRepository } from "./binderrepository";
import { CollectionElement } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { CollectionRepository } from "./collectionrepository";
import { ES_MAX_RESULTS } from "../const";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const elementsToItems = async (elements: CollectionElement[], bindersRepository: BindersRepository, collectionRepository: CollectionRepository) => {
    const { binderIds, collectionIds } = elements.reduce((reduced, { key, kind }) => {
        if (kind === "collection") {
            reduced.collectionIds.push(key);
        } else {
            reduced.binderIds.push(key);
        }
        return reduced;
    }, { binderIds: [], collectionIds: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elementItems: any[] = [];
    if (binderIds.length) {
        const binderElements = await bindersRepository.findBinders({ binderIds }, { maxResults: ES_MAX_RESULTS });
        elementItems.push(...binderElements);
    }
    if (collectionIds.length) {
        const collectionElements = await collectionRepository.findCollections({ ids: collectionIds }, { maxResults: ES_MAX_RESULTS });
        elementItems.push(...collectionElements);
    }
    return elementItems;
}
