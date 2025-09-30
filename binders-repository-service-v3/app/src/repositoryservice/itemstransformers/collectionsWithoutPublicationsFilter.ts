import { Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ItemsTransformer } from "@binders/binders-service-common/lib/itemstransformers";
import { isCollectionItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";


export class CollectionsWithoutPublicationsFilterTransformer implements ItemsTransformer {

    async items(items: Item[]): Promise<Item[]> {
        return items.filter(item => {
            if (!isCollectionItem(item)) return true;
            return item.hasPublications !== false;
        });
    }

}
