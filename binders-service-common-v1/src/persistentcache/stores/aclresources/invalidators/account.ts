import { AccountInvalidateEvent } from "../../../../cache/invalidating/invalidateevents";
import { AclResourcesStore } from "../aclresourcesstore";
import { Invalidator } from "../../../../cache/invalidating/invalidator";
import { RedisClient } from "../../../../redis/client";


export class AclResourcesAccountInvalidator
    extends Invalidator<AccountInvalidateEvent>
{
    private cache: AclResourcesStore;
    
    constructor(client: RedisClient) {
        super(client);
        this.cache = new AclResourcesStore(client);
    }
    
    onDelete(events: AccountInvalidateEvent[]): Promise<void> {
        return this.cache.invalidateAclResourcesCacheForAccounts(
            events.map(e => e.accountId)
        )
    }
}
