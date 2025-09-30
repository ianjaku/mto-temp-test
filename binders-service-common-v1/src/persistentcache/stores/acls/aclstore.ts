/**
 * Cache format (redis K/V):
 * [prefix/version/resourceId] => [Acl[] as json]
*/
import { Acl, ResourceGroup } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { RedisClient } from "../../../redis/client";
import { SimpleKVCache } from "../simplekvcache";


export class AclsStore extends SimpleKVCache<Acl[]> {

    constructor(client: RedisClient) {
        super(
            "auth-acl",
            "4",
            client
        );
    }

    async fetchCachedAclsForResourceGroups(
        resources: ResourceGroup[],
        accountId?: string
    ): Promise<{
        acls: Acl[],
        foundResources: ResourceGroup[],
        notFoundResources: ResourceGroup[]
    }> {
        const resourceIds = resources.reduce((ids, group) => {
            return [...ids, ...group.ids];
        }, []);
        const {
            acls,
            foundIds,
        } = await this.fetchCachedAcls(resourceIds, accountId);
        const foundIdsSet = new Set(foundIds);

        const notFoundResources: ResourceGroup[] = [];
        const foundResources: ResourceGroup[] = [];
    
        for (const resource of resources) {
            const resourceFoundIds: string[] = [];
            const resourceNotFoundIds: string[] = [];
            for (const id of resource.ids) {
                if (foundIdsSet.has(id)) {
                    resourceFoundIds.push(id)
                } else {
                    resourceNotFoundIds.push(id);
                }
            }
            if (resourceFoundIds.length !== 0) {
                foundResources.push({
                    ...resource,
                    ids: resourceFoundIds
                });
            }
            if (resourceNotFoundIds.length !== 0) {
                notFoundResources.push({
                    ...resource,
                    ids: resourceNotFoundIds
                })
            }
        }

        return {
            acls,
            foundResources,
            notFoundResources
        };
    }

    async fetchCachedAcls(
        resourceIds: string[],
        accountId?: string
    ): Promise<{
        acls: Acl[],
        foundIds: string[],
        notFoundIds: string[]
    }> {
        const queryResults = await this.getMany(resourceIds);

        const acls: Acl[] = [];
        const foundIds: string[] = [];
        const notFoundIds: string[] = [];

        for (const queryResult of queryResults) {
            if (queryResult.value == null) {
                notFoundIds.push(queryResult.key);
            } else {
                foundIds.push(queryResult.key);
                acls.push(...queryResult.value);
            }
        }

        let filteredAcls = acls;
        if (accountId != null) {
            filteredAcls = filteredAcls.filter(acl => acl.accountId === accountId);
        }
    
        return {
            acls: filteredAcls,
            foundIds,
            notFoundIds
        }
    }

    cacheAclsForResourceId (
        resourceId: string,
        acls: Acl[]
    ): Promise<void> {
        return this.set(resourceId, acls);
    }


    async cacheAclsForResourceIds(
        aclsByResource: {[resourceId: string]: Acl[]}
    ): Promise<void> {
        // We send 1 command at the time because the serialized acls string can be quite big
        const promises = Object.keys(aclsByResource).map(resourceId => (
            this.cacheAclsForResourceId(resourceId, aclsByResource[resourceId])
        ));
        await Promise.all(promises);
    }

    invalidateCachedAclsForResources(
        resourceIds: string[]
    ): Promise<void> {
        return this.remove(resourceIds);
    }
    
}
