import { AncestorsStore } from "../ancestorsstore";
import { DocumentInvalidateEvent } from "../../../../cache/invalidating/invalidateevents";
import { Invalidator } from "../../../../cache/invalidating/invalidator";
import { RedisClient } from "../../../../redis/client";
import { flatten } from "ramda";


export class AncestorsDocumentInvalidator
    extends Invalidator<DocumentInvalidateEvent> {

    private ancestorStore: AncestorsStore;
    
    constructor(client: RedisClient) {
        super(client);
        this.ancestorStore = new AncestorsStore(client);
    }
    
    onCreate(events: DocumentInvalidateEvent[]): Promise<void> {
        const nestedIds = events.map(event => event.documentId);
        const ids = flatten(nestedIds);
        return this.ancestorStore.invalidateCachedAncestorsForItems(ids);
    }

    onDelete(events: DocumentInvalidateEvent[]): Promise<void> {
        const nestedIds = events.map(event => event.documentId);
        const ids = flatten(nestedIds);
        return this.ancestorStore.invalidateCachedAncestorsForItems(ids);
    }
}
