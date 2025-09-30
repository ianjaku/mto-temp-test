/**
* This stores, for every account, all resource ids that have an Acl linked to them.
* Format(Set):
*  [accountId] -> [resourceId1, resourceId2, resourceId3]
*/
import { RedisClient } from "../../../redis/client";
import { redisMismemberWithValues } from "../redis";

type PromiseOrNot<T> = Promise<T> | T;

export type FetchResourceIdsForAccounts = (
        accountIds: string[]
    ) => PromiseOrNot<{[accountId: string]: string[]}>;


export interface FilterForAccountsResponse {
    confirmedIds: string[];
    unconfirmedIds: string[];
}


export class AclResourcesStore {

    private IDENTIFIER = "auth-aclresids";
    private VERSION = "3";

    constructor(
        private readonly client: RedisClient
    ) {}

    async hasResourceIdsForAccount(
        accountId: string
    ): Promise<boolean> {
        const result = await this.client.exists(this.getKey(accountId));
        return !!result;
    }

    async filterResourceIdsWithoutAcl(
        accountId: string,
        resourceIds: string[]
    ): Promise<string[]> {
        if (resourceIds.length === 0) return [];
        const result = await redisMismemberWithValues(
            this.client,
            this.getKey(accountId),
            resourceIds
        );
        return result.found;
    }

    async cacheIdsWithAclForAccounts(
        resourceIds: {[accountId: string]: string[]}
    ): Promise<void> {
        await Promise.all(
            Object.keys(resourceIds).map(
                accountId => this.cacheIdsWithAclForAccount(
                    accountId,
                    resourceIds[accountId]
                )
            )
        );
    }

    async cacheIdsWithAclForAccount(
        accountId: string,
        resourceIds: string[]
    ): Promise<void> {
        await this.invalidateAclResourcesCacheForAccounts([accountId]);
        await this.client.sadd(
            this.getKey(accountId),
            ...resourceIds
        );
    }

    async invalidateAclResourcesCacheForAccounts(
        accountIds: string[]
    ): Promise<void> {
        const keys = accountIds.map(id => this.getKey(id));
        await this.client.del(...keys);
    }

    private getKey(id: string) {
        return [this.IDENTIFIER, this.VERSION, id].join("/");
    }
}
