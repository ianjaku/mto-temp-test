import { GroupsStore } from "../groupsstore";
import { Invalidator } from "../../../../cache/invalidating/invalidator";
import { RedisClient } from "../../../../redis/client";
import { UserInvalidateEvent } from "../../../../cache/invalidating/invalidateevents";

export class GroupsUserInvalidator extends Invalidator<UserInvalidateEvent> {

    private groupsCache: GroupsStore;

    constructor(client: RedisClient) {
        super(client);
        this.groupsCache = new GroupsStore(client);
    }

    async onDelete(events: UserInvalidateEvent[]): Promise<void> {
        const promises = events.map(
            event => this.groupsCache.invalidateUsers([event.userId])
        );
        await Promise.all(promises);
    }
}
