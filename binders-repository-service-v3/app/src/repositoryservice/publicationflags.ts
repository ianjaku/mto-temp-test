import { CollectionElement, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { CollectionRepository } from "./repositories/collectionrepository";
import { ES_MAX_RESULTS } from "./const";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { PublicationRepository } from "./repositories/publicationrepository";

const splitDocsAndCols = (elements: CollectionElement[]) => {
    return elements.reduce((reduced, elem) => {
        if (elem.kind === "collection") {
            reduced.cols.push(elem);
        } else {
            reduced.docs.push(elem);
        }
        return reduced;
    }, { cols: [], docs: [] });
}

class HasPublicationsResolver {
    readonly resolvedWith: Set<string>;
    readonly resolvedWithout: Set<string>;

    constructor(
        private readonly publicationRepository: PublicationRepository,
        private readonly collectionRepository: CollectionRepository,
        private readonly logger: Logger,
    ) {
        this.resolvedWith = new Set();
        this.resolvedWithout = new Set();
    }

    private async bubbleUpFlag(collectionIds: string[]) {
        const parents = await this.collectionRepository.findCollections({ itemIds: collectionIds }, { maxResults: ES_MAX_RESULTS });
        const toUpdate = parents.filter(p => !p.hasPublications);
        const updated = toUpdate.map(c => ({
            ...c,
            hasPublications: true
        }));
        for (const updatedCollection of updated) {
            await this.collectionRepository.updateCollection(updatedCollection);
        }
        if (!updated.length) {
            return; // bubble reached the top. *POP*
        }
        await this.bubbleUpFlag(updated.map(c => c.id));
    }

    private async bubbleUpResolve(collectionIds: string[]) {
        const parents = await this.collectionRepository.findCollections({ itemIds: collectionIds }, { maxResults: ES_MAX_RESULTS });
        const toExamine = parents.filter(p => p.hasPublications);
        for (const col of toExamine) {
            await this.resolveCollection(col);
        }
    }

    private async updateCollection(collection: DocumentCollection, newHasPublications: boolean) {
        if (collection.hasPublications === newHasPublications) {
            return;
        }
        collection.hasPublications = newHasPublications;
        await this.collectionRepository.updateCollection(collection);
        if (newHasPublications) {
            await this.bubbleUpFlag([collection.id]); // We need to make sure all parents have hasPublications set to true
        } else {
            await this.bubbleUpResolve([collection.id]); // We need to investigate parents with flag to true, it might turn false
        }
    }

    async resolveCollection(collection: DocumentCollection): Promise<boolean> {
        const { cols, docs } = splitDocsAndCols(collection.elements);

        if (docs && docs.length) {
            const binderIds = docs.map(({ key }) => key);
            const pubs = await this.publicationRepository.find({ binderIds, isActive: 1 }, { maxResults: 1 });
            if (pubs.length > 0) {
                await this.updateCollection(collection, true);
                return true;
            }
        }

        if (cols && cols.length) {
            const collectionIds = cols.map(({ key }) => key);
            const collections = await this.collectionRepository.findCollections({ ids: collectionIds }, { maxResults: cols.length + 1 });
            for (const subCollection of collections) {
                if (subCollection.hasPublications) {
                    await this.updateCollection(collection, true);
                    return true;
                }
            }
        }
        await this.updateCollection(collection, false);
        return false;
    }
}

export default HasPublicationsResolver;
