/**
* Format (Key Value):
* [PREFIX/VERSION/userId] -> [group1/group2/group3/.. or "empty"]
*/
import { RedisClient } from "../../../redis/client";
import { SimpleKVCache } from "../simplekvcache";
import { Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";

export class GroupsStore extends SimpleKVCache<Usergroup[]> {

    constructor(client: RedisClient) {
        super(
            "auth-groups",
            "15",
            client
        );
    }

    async getGroups(
        userId: string,
        accountId?: string
    ): Promise<Usergroup[] | null> {
        const cachedGroups = await this.get(userId);
        if (cachedGroups == null || accountId == null) return null;
        if (accountId == null) return cachedGroups;
        return cachedGroups
            .filter(group => group.accountId === accountId);
    }

    async setGroups(
        userId: string,
        groups: Usergroup[]
    ): Promise<void> {
        return this.set(userId, groups);
    }

    async invalidateUsers(
        userIds: string[]
    ): Promise<void> {
        return this.remove(userIds);
    }
}
