import {
    ArchiveBinderPopulator,
    ArchiveCollectionPopulator,
    ArchiveInstancePopulator,
    IContentExporterOptions
} from "./ContentExporter";
import {
    Binder,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { buildDirName, sanitizeFilename } from "./helpers";
import { Archiver } from "archiver";
import { CollectionRepository } from "../../repositoryservice/repositories/collectionrepository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { MultiRepository } from "../../repositoryservice/repositories/multirepository";

export interface ICrawlerReport {
    errors: string[];
}
export default class ContentCrawler {

    private instanceLocations: Map<string, string>;
    private errors: string[] = [];

    constructor(
        private archiveBinderPopulator: ArchiveBinderPopulator,
        private archiveCollectionPopulator: ArchiveCollectionPopulator,
        private archiveInstancePopulator: ArchiveInstancePopulator,
        private multiRepository: MultiRepository,
        private collectionRepository: CollectionRepository,
        private options: IContentExporterOptions = {},
        private logger: Logger
    ) {
        this.instanceLocations = new Map<string, string>();
    }

    async crawlStep(itemId: string, archiveStream: Archiver, itemPath: string, isInstance: boolean): Promise<void> {

        const { useItemNamesAsDirs, processInstancesAsStandaloneBinders } = this.options;

        if (isInstance && !processInstancesAsStandaloneBinders) {
            const instanceOriginalWasProcessed = this.instanceLocations.has(itemId);
            if (instanceOriginalWasProcessed) {
                await this.archiveInstancePopulator(archiveStream, itemId, itemPath);
                return;
            }
            this.instanceLocations.set(itemId, itemPath);
        }
        const item = await this.multiRepository.getBinderOrCollection(itemId);
        const isCol = "elements" in item;
        if (isCol) {
            const collection = item as DocumentCollection;

            await this.archiveCollectionPopulator(archiveStream, item as DocumentCollection, itemPath);

            const { elements } = collection;
            if (!elements.length) {
                return;
            }
            const idsOfMultiOccurrences = await this.collectionRepository.getIdsOfMultiElements(elements.map(e => e.key));

            let childMasterTitles = {};
            if (useItemNamesAsDirs) {
                const childItems = await this.multiRepository.findItems({ ids: elements.map(e => e.key) }, { maxResults: 9999 })
                childMasterTitles = childItems.reduce((reduced, child) => {
                    return {
                        ...reduced,
                        [child.id]: buildDirName(child),
                    }
                }, {});
            }

            for (const element of elements) {
                const { key: elementItemId } = element;
                const dirName = useItemNamesAsDirs ?
                    childMasterTitles[elementItemId] :
                    elementItemId;
                const dirNameSanitized = sanitizeFilename(dirName);
                const subItemPath = `${itemPath}${dirNameSanitized}/`;
                try {
                    await this.crawlStep(elementItemId, archiveStream, subItemPath, idsOfMultiOccurrences.includes(elementItemId));
                } catch (e) {
                    this.logger.error(e, "content-export-crawler")
                    this.errors.push(`Error in processing item ${elementItemId} in collection ${item.id}: ${e.stack}`);
                }
            }
            return;
        } else {
            await this.archiveBinderPopulator(archiveStream, item as Binder, itemPath);
        }
    }

    async crawl(archiveStream: Archiver, itemId: string): Promise<ICrawlerReport> {
        const { useItemNamesAsDirs } = this.options;
        let itemDirName;
        if (useItemNamesAsDirs) {
            const item = await this.multiRepository.getBinderOrCollection(itemId);
            itemDirName = buildDirName(item);
        } else {
            itemDirName = itemId;
        }
        this.errors = [];
        await this.crawlStep(itemId, archiveStream, `${itemDirName}/`, false);
        return {
            errors: this.errors,
        }
    }

}
