import {
    isBinderItem,
    isBinderSummaryItem
} from  "@binders/client/lib/clients/repositoryservice/v3/validation";
import { Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ItemsTransformer } from "@binders/binders-service-common/lib/itemstransformers";
import { PublicationRepository } from "../repositories/publicationrepository";

export class AddHasPublicationsTransformer implements ItemsTransformer {

    constructor(
        private publicationRepository: PublicationRepository
    ) {}

    async items(items: Item[]): Promise<Item[]> {
        const binderIds = this.getBinderIds(items);
        const publishedBinderIds = await this.publicationRepository.filterPublicationlessBinders(binderIds);
        const publishedBinderIdsSet = new Set(publishedBinderIds);

        return items.map(item => {
            if (isBinderSummaryItem(item) || isBinderItem(item)) {
                item.hasPublications = publishedBinderIdsSet.has(item.id);
            }
            return item;
        });
    }

    private getBinderIds(items: Item[]): string[] {
        const ids = [];
        for (const item of items) {
            if (isBinderSummaryItem(item) || isBinderItem(item)) {
                ids.push(item.id);
            }
        }
        return ids;
    }
    
}
