import {
    AccountServiceContract,
    FEATURE_COLLECTION_HIDE
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import {
    isPublicationItem,
    isPublicationSummaryItem
} from  "@binders/client/lib/clients/repositoryservice/v3/validation";
import { AncestorBuilder } from "../ancestors/ancestorBuilder";
import { Item } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ItemsTransformer } from "@binders/binders-service-common/lib/itemstransformers";
import { hasAtLeastOneVisibleParentPath } from "@binders/client/lib/ancestors";


export class HiddenAncestorsFilterTransformer implements ItemsTransformer {

    constructor(
        private accountId: string,
        private accountService: AccountServiceContract,
        private ancestorBuilder: AncestorBuilder
    ) {}

    async items(items: Item[]): Promise<Item[]> {
        const accountFeatures = await this.accountService.getAccountFeatures(this.accountId);
        const shouldFilterHiddenAncestors = accountFeatures.includes(FEATURE_COLLECTION_HIDE);
        if (!shouldFilterHiddenAncestors) return items;

        return await this.filterChildrenOfHiddenAncestor(items);
    }

    private async filterChildrenOfHiddenAncestor(items: Item[]) {
        const documentAncestors = await this.ancestorBuilder.getAncestors(items.map(item => this.getBinderId(item)));
        return items.filter(item => {
            return hasAtLeastOneVisibleParentPath(documentAncestors, [item.id], [])
        });
    }

    private getBinderId(item: Item): string {
        if (isPublicationItem(item) || isPublicationSummaryItem(item)) {
            return item.binderId;
        }
        return item.id;
    }
    
}
