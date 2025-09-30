import { RedisClient, RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import { AccountsWithPermissions } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";

const EXPIRE_IN_24_HOURS = 24 * 60 * 60;

/*
    This cache stores the permissions of a particular user, grouped by accounts
    Caution: it only stores edit and admin permissions, no read permissions
*/
export interface IRedisPermissionsRepository {
    setAccountsWithPermissions(userId: string, accounts: AccountsWithPermissions[]): Promise<void>;
    getAccountsWithPermissions(userId: string): Promise<AccountsWithPermissions[]>;
    invalidatePermissionsForUser(userId: string): Promise<void>;
}

export class RedisPermissionsRepository implements IRedisPermissionsRepository {

    static VERSION = 2;

    constructor(protected redis: RedisClient) {
    }

    private buildUserKey(userId: string) {
        return `${userId}-permissions-accounts-${RedisPermissionsRepository.VERSION}`;
    }

    async setAccountsWithPermissions(userId: string, accounts: AccountsWithPermissions[]): Promise<void> {
        const userKey = this.buildUserKey(userId);
        await this.redis.set(userKey, JSON.stringify(accounts));
        await this.redis.expire(userKey, EXPIRE_IN_24_HOURS);
    }

    async getAccountsWithPermissions(userId: string): Promise<AccountsWithPermissions[]> {
        const userKey = this.buildUserKey(userId);
        const value = await this.redis.get(userKey);
        return value ? JSON.parse(value) : [];
    }

    async invalidatePermissionsForUser(userId: string): Promise<void> {
        const setKey = this.buildUserKey(userId);
        await this.redis.del(setKey);
    }

    static fromConfig(config: Config): RedisPermissionsRepository {
        const client = RedisClientBuilder.fromConfig(config, "accountsPermissions");
        return new RedisPermissionsRepository(client);
    }
}