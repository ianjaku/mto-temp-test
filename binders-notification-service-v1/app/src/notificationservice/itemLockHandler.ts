import {
    AllItemLocksServiceNotification,
    DispatchHookSuccess,
    IDispatchHookResult,
    ItemLock,
    ItemLockServiceNotification,
    ItemRelease,
    ServiceNotificationType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { RedisClient } from "@binders/binders-service-common/lib/redis/client";

function serializeLockOptions(lockVisibleByInitiator: unknown) {
    return `${lockVisibleByInitiator ? "1" : 0}`;
}

function parseSerializedLockOptions(serialized: string) {
    return {
        lockVisibleByInitiator: !!parseInt(serialized[0]),
    }
}

const RESOURCE_TTL_SECONDS = 600; // 10 minutes
const LOG_CATEGORY = "redis-itemlocks";

export default class ItemLockHandler {

    constructor(private redisClient: RedisClient) {
    }

    async ensureAccountHasSet(accountId: string, logger?: Logger): Promise<void> {
        const MIGRATION_LOGS_CATEGORY = `${LOG_CATEGORY}-migration`
        const migrationKey = "itemlocks-migrations-account-set-2025-09";

        try {
            const hasMigrated = await this.redisClient.sismember(migrationKey, accountId);
            if (hasMigrated === 0) {
                logger?.trace(`Start migration of item locks for account ${accountId}`, MIGRATION_LOGS_CATEGORY);
                const itemlockKeys = await this.getLockKeysByScan(accountId);
                if (itemlockKeys.length > 0) {
                    const accountSetKey = this.getAccountLocksSetKey(accountId)
                    await this.redisClient.sadd(accountSetKey, ...itemlockKeys);
                }
                await this.redisClient.sadd(migrationKey, accountId);
            }
        } catch (err) {
            logger?.logException(err, MIGRATION_LOGS_CATEGORY)
            throw err;
        }
    }

    private getAccountLocksSetKey(accountId: string) {
        return `itemlocks-by-account:${accountId}`;
    }

    private setLockExpiration(itemlockKey: string) {
        this.redisClient.expire(itemlockKey, RESOURCE_TTL_SECONDS);
    }

    private async createLock(accountId: string, itemlockKey: string, lock: ItemLock, logger: Logger) {
        await this.redisClient.hmset(
            itemlockKey,
            "userId", lock.user.id,
            "login", lock.user.login,
            "displayName", lock.user.displayName,
            "windowId", lock.windowId
        );
        this.setLockExpiration(itemlockKey);
        const accountSetKey = this.getAccountLocksSetKey(accountId);
        await this.redisClient.sadd(accountSetKey, itemlockKey);
        logger.trace(`added lock ${itemlockKey}`, "redis-locking");
    }

    private async releaseLock(accountId: string, itemlockKey: string) {
        await this.redisClient.del(itemlockKey);
        const accountSetKey = this.getAccountLocksSetKey(accountId)
        await this.redisClient.srem(accountSetKey, itemlockKey);

    }

    async lock(accountId: string, body: ItemLock, logger: Logger, isOverride?: boolean): Promise<IDispatchHookResult<ItemLockServiceNotification>> {
        try {
            await this.ensureAccountHasSet(accountId, logger);
            const lockOptionsSerialized = serializeLockOptions(body?.lockVisibleByInitiator);
            const itemlockKey = `itemlocks:${accountId}:${body.itemId}:${lockOptionsSerialized}`;

            if (!isOverride) {
                const existingLock = await this.redisClient.hgetall(itemlockKey) || {};
                if (Object.keys(existingLock).length) {
                    const { userId, login, displayName, windowId } = existingLock;
                    logger.trace("lock exists. Resetting TTL and dispatching ITEM_LOCKED with current lock info", "redis-locking");
                    this.setLockExpiration(itemlockKey);
                    return {
                        overriddenServiceNotification: {
                            type: ServiceNotificationType.ITEM_LOCKED,
                            body: {
                                itemId: body.itemId,
                                user: {
                                    id: userId,
                                    login,
                                    displayName,
                                },
                                windowId,
                            },
                            windowId,
                        }
                    };
                }
            }
            await this.createLock(accountId, itemlockKey, body, logger);
            return DispatchHookSuccess;
        }
        catch (err) {
            logger.error(`error in added lock ${err}`, "redis-locking");
            return { interruptDispatch: true };
        }
    }

    async unlock(accountId: string, body: ItemRelease, logger: Logger): Promise<IDispatchHookResult> {
        try {
            await this.ensureAccountHasSet(accountId, logger);
            const lockOptionsSerialized = serializeLockOptions(body?.lockVisibleByInitiator);
            const { itemId, userId, windowId } = body;
            const itemlockKey = `itemlocks:${accountId}:${itemId}:${lockOptionsSerialized}`;
            const [redisUserId, redisWindowId] = await this.redisClient.hmget(itemlockKey, "userId", "windowId");

            if (redisUserId === userId && windowId == redisWindowId) {
                await this.releaseLock(accountId, itemlockKey)
                logger.trace(`released lock ${itemlockKey}`, "redis-locking");
                return DispatchHookSuccess;
            }
            return { interruptDispatch: true };
        }
        catch (err) {
            logger.error(`error in releasing lock ${err}`, "redis-locking");
            return { interruptDispatch: true };
        }
    }

    async getLocks(accountId: string): Promise<AllItemLocksServiceNotification> {
        await this.ensureAccountHasSet(accountId);
        const accountSetKey = this.getAccountLocksSetKey(accountId);
        const itemLockKeys = await this.redisClient.smembers(accountSetKey);

        /* Keeps track of account locks that passed their TTL and were removed from the hash */
        const expiredItemLockKeys: string[] = [];
        const editPromises = itemLockKeys.map(async (itemLockKey): Promise<ItemLock | undefined> => {
            const [, , itemId, lockOptionsSerialized] = itemLockKey.split(":");
            const lockOptions = parseSerializedLockOptions(lockOptionsSerialized);
            const resourceFields = await this.redisClient.hgetall(itemLockKey);
            if (Object.keys(resourceFields).length === 0) {
                expiredItemLockKeys.push(itemLockKey);
                return undefined;
            }
            return {
                itemId,
                user: {
                    id: resourceFields["userId"],
                    displayName: resourceFields["displayName"],
                    login: resourceFields["login"],
                },
                windowId: resourceFields["windowId"],
                ...lockOptions,
            };
        });

        const edits = await Promise.all(editPromises);
        void this.removeExpiredAccountItemLockKeys(accountSetKey, expiredItemLockKeys);
        const validEdits = edits.filter(edit => edit);
        return validEdits.length ?
            {
                type: ServiceNotificationType.ALL_LOCKED_ITEMS,
                body: { edits: validEdits }
            } :
            undefined;
    }

    private async removeExpiredAccountItemLockKeys(accountKeySet: string, itemLockKeys: string[]): Promise<void> {
        if (itemLockKeys.length === 0) {
            return;
        }
        await this.redisClient.srem(accountKeySet, ...itemLockKeys);
    }

    async getLockKeysByScan(accountId: string): Promise<string[]> {
        const response = await this.redisClient.scan(0, "MATCH", `*itemlocks:${accountId}:*`, "COUNT", 10000000);
        return response.pop() as string[];
    }
}
