import {
    BindersRepositoryServiceContract,
    DocumentAncestors
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { AncestorsStore } from "../stores/ancestors/ancestorsstore";
import { BackendRepoServiceClient } from "../../apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { createPermanentCacheRedis } from "../stores/redis";

export class AncestorsCache {

    constructor(
        private readonly ancestorsStore: AncestorsStore,
        private readonly repoService: BindersRepositoryServiceContract
    ) {}
    
    async getItemsAncestors(
        itemIds: string[]
    ): Promise<DocumentAncestors> {
        const cached = await this.ancestorsStore.fetchCachedAncestors(itemIds);
        if (cached.notFoundIds.length === 0) {
            return cached.ancestors;
        }
        const ancestors = await this.repoService.getItemsAncestors(itemIds);
        this.ancestorsStore.cacheDocumentAncestors(ancestors);
        return ancestors;
    }

    static async fromConfig(config: Config): Promise<AncestorsCache> {
        const redisClient = createPermanentCacheRedis(config);
        return new AncestorsCache(
            new AncestorsStore(redisClient),
            await BackendRepoServiceClient.fromConfig(config, "ancestors-cache")
        );
    }
}
