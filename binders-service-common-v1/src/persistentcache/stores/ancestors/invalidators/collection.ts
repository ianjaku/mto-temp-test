import { AncestorsStore } from "../ancestorsstore";
import { CollectionInvalidateEvent } from "../../../../cache/invalidating/invalidateevents";
import { Invalidator } from "../../../../cache/invalidating/invalidator";
import { RedisClient } from "../../../../redis/client";
import { flatten } from "ramda";


export class AncestorsCollectionInvalidator
    extends Invalidator<CollectionInvalidateEvent> {

    private ancestorStore: AncestorsStore;
    
    constructor(client: RedisClient) {
        super(client);
        this.ancestorStore = new AncestorsStore(client);
    }
    
    onCreate(events: CollectionInvalidateEvent[]): Promise<void> {
        const nestedIds = events.map(event => event.collectionId);
        const ids = flatten(nestedIds);
        return this.ancestorStore.invalidateCachedAncestorsForItems(ids);
    }

    onDelete(events: CollectionInvalidateEvent[]): Promise<void> {
        const nestedIds = events.map(event => event.collectionId);
        const ids = flatten(nestedIds);
        return this.ancestorStore.invalidateCachedAncestorsForItems(ids);
    }

    onUpdate(events: CollectionInvalidateEvent[]): Promise<void> {
        const nestedIds = events.map(event => event.collectionId);
        const ids = flatten(nestedIds);
        return this.ancestorStore.invalidateCachedAncestorsForItems(ids);
    }
}
