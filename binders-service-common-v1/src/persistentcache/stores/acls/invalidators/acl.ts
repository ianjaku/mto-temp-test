import { AclInvalidateEvent } from "../../../../cache/invalidating/invalidateevents";
import { AclsStore } from "../aclstore";
import { Invalidator } from "../../../../cache/invalidating/invalidator";
import { RedisClient } from "../../../../redis/client";


export class AclsAclInvalidator extends Invalidator<AclInvalidateEvent> {

    private aclsStore: AclsStore;

    constructor(client: RedisClient) {
        super(client);
        this.aclsStore = new AclsStore(client);
    }

    private async invalidate(events: AclInvalidateEvent[]): Promise<void> {
        const promises = events.map(
            event => this.aclsStore.invalidateCachedAclsForResources(
                event.resourceIds
            )
        );
        await Promise.all(promises);
    }

    onCreate(events: AclInvalidateEvent[]): Promise<void> {
        return this.invalidate(events);
    }

    onDelete(events: AclInvalidateEvent[]): Promise<void> {
        return this.invalidate(events);
    }

    onUpdate(events: AclInvalidateEvent[]): Promise<void> {
        return this.invalidate(events);
    }
}
