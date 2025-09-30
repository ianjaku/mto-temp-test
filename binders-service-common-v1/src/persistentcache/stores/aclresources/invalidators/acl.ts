import { AccountInvalidateEvent } from "../../../../cache/invalidating/invalidateevents";
import { AclResourcesStore } from "../aclresourcesstore";
import { Invalidator } from "../../../../cache/invalidating/invalidator";
import { RedisClient } from "../../../../redis/client";


export class AclResourcesAclInvalidator extends Invalidator<AccountInvalidateEvent> {

    private aclResourcesCache: AclResourcesStore;
    
    constructor(client: RedisClient) {
        super(client);
        this.aclResourcesCache = new AclResourcesStore(client);
    }

    onCreate(events: AccountInvalidateEvent[]): Promise<void> {
        return this.aclResourcesCache.invalidateAclResourcesCacheForAccounts(
            events.map(e => e.accountId)
        );
    }

    onDelete(events: AccountInvalidateEvent[]): Promise<void> {
        return this.aclResourcesCache.invalidateAclResourcesCacheForAccounts(
            events.map(e => e.accountId)
        );
    }

    onUpdate(events: AccountInvalidateEvent[]): Promise<void> {
        return this.aclResourcesCache.invalidateAclResourcesCacheForAccounts(
            events.map(e => e.accountId)
        );
    }
}
