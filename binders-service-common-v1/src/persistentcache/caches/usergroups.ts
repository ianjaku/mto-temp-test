import {
    UserServiceContract,
    Usergroup
} from  "@binders/client/lib/clients/userservice/v1/contract";
import { BackendUserServiceClient } from "../../apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { GroupsStore } from "../stores/groups/groupsstore";
import { createPermanentCacheRedis } from "../stores/redis";

export class UserGroupsCache {

    constructor(
        private readonly groupStore: GroupsStore,
        private readonly userService: UserServiceContract
    ) {}

    async fetchUserGroup(
        accountId: string,
        userId: string
    ): Promise<Usergroup[]> {
        const cached = await this.groupStore.getGroups(userId, accountId)
        if (cached != null) return cached;
        const groups = await this.userService.getGroupsForUserBackend(userId);
        this.groupStore.setGroups(userId, groups);
        const result = groups.filter(g => g.accountId === accountId);
        return result;
    }
    
    static async fromConfig(config: Config): Promise<UserGroupsCache> {
        const redisClient = createPermanentCacheRedis(config);
        return new UserGroupsCache(
            new GroupsStore(redisClient),
            await BackendUserServiceClient.fromConfig(config, "permanent-cache")
        );
    }
}
