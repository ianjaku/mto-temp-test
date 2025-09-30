import { GroupsStore } from "../groupsstore";
import { Invalidator } from "../../../../cache/invalidating/invalidator";
import { RedisClient } from "../../../../redis/client";
import { UserGroupInvalidateEvent } from "../../../../cache/invalidating/invalidateevents";

export class GroupsGroupInvalidator extends Invalidator<UserGroupInvalidateEvent> {

    private groupsCache: GroupsStore;

    constructor(client: RedisClient) {
        super(client);
        this.groupsCache = new GroupsStore(client);
    }

    private async invalidate(events: UserGroupInvalidateEvent[]) {
        const promises = events.map(
            event => this.groupsCache.invalidateUsers(event.userIds)
        );
        await Promise.all(promises);
    }

    onDelete(events: UserGroupInvalidateEvent[]): Promise<void> {
        return this.invalidate(events);
    }

    onUpdate(events: UserGroupInvalidateEvent[]): Promise<void> {
        return this.invalidate(events);
    }

    onCreate(events: UserGroupInvalidateEvent[]): Promise<void> {
        return this.invalidate(events);
    }
}
