import { DocumentAncestors } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { RedisClient } from "../../../redis/client";
import { SimpleKVCache } from "../simplekvcache";


export class AncestorsStore extends SimpleKVCache<string[]> {
    constructor(client: RedisClient) {
        super(
            "auth-ancestors",
            "4",
            client
        );
    }
    
    async fetchCachedAncestors(
        itemIds: string[]
    ): Promise<{
        ancestors: DocumentAncestors,
        notFoundIds: string[]
    }> {
        const ancestors: DocumentAncestors = {};
    
        const items = await this.getMany(itemIds)
        const notFoundIds: string[] = [];
        const allParentIds: string[] = [];
        for (const item of items) {
            if (item.value == null) {
                notFoundIds.push(item.key);
            } else {
                ancestors[item.key] = item.value;
                allParentIds.push(...item.value);
            }
        }

        if (allParentIds.length === 0) {
            return {
                ancestors,
                notFoundIds
            };
        }

        const {
            ancestors: grandParents,
            notFoundIds: notFoundGrandparents
        } = await this.fetchCachedAncestors(allParentIds);

        return {
            ancestors: {
                ...ancestors,
                ...grandParents
            },
            notFoundIds: [
                ...notFoundIds,
                ...notFoundGrandparents
            ]
        };
    }

    async cacheDocumentAncestors(
        ancestors: DocumentAncestors
    ): Promise<void> {
        return this.setMany(ancestors);
    }

    async invalidateCachedAncestorsForItems(
        itemIds: string[]
    ): Promise<void> {
        return this.remove(itemIds);
    }

}
