import {
    BackendAccountServiceClient,
    BackendRepoServiceClient,
    BackendUserServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Notification,
    NotificationKind,
    NotificationTarget,
    NotifierKind,
    SimpleTarget
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
import { Config } from "@binders/client/lib/config/config";
import { NotificationTargetsRepository, } from "../repositories/notificationtargets";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import {
    isCustomNotification
} from  "@binders/client/lib/clients/notificationservice/v1/validation";
import { uniq } from "ramda";


function filterNonExistingUsers(members: string[], groupIds: string[]) {
    const membersSet = new Set(members);
    const groupIdsSet = new Set(groupIds);
    return (target: SimpleTarget): boolean => {
        return membersSet.has(target.targetId) || groupIdsSet.has(target.targetId);
    }
}

export class TargetResolver {

    constructor(
        private readonly accountId: string,
        private readonly accountService: AccountServiceClient,
        private readonly notificationTargetsRepository: NotificationTargetsRepository,
        private readonly repoClient: BinderRepositoryServiceClient,
        private readonly userServiceClient: UserServiceClient
    ) { }

    private async fetchAccountMemberIdsAndGroupIds(): Promise<{ memberIds: string[], groupIds: string[] }> {
        const [account, groups] = await Promise.all([
            this.accountService.getAccount(this.accountId),
            this.userServiceClient.getGroups(this.accountId)
        ]);
        return {
            memberIds: account.members,
            groupIds: groups.map(g => g.id)
        }
    }

    async resolve(event: Notification): Promise<User[]> {
        const targets = await this.fetchTargets(event);
        const targetIds = targets.filter(t => t.notificationKind === event.kind).map(t => t.targetId);
        const uniqueTargetIds = uniq(targetIds);
        return await this.userServiceClient.getUsers(uniqueTargetIds);
    }

    private async fetchTargets(
        event: Notification
    ): Promise<NotificationTarget[]> {
        const { memberIds, groupIds } = await this.fetchAccountMemberIdsAndGroupIds();

        if (isCustomNotification(event)) {
            return event.targets
                .filter(filterNonExistingUsers(memberIds, groupIds))
                .map(target => ({
                    ...target,
                    accountId: event.accountId,
                    notificationKind: NotificationKind.CUSTOM
                }));
        }

        const ancestors = await this.repoClient.getAncestors(event.itemId);
        const targets = await this.notificationTargetsRepository.findForAccount(
            this.accountId,
            event.kind,
            Object.keys(ancestors)
        );
        return targets
            .filter(filterNonExistingUsers(memberIds, groupIds))
            .filter(target => 
                target.notifierKind !== NotifierKind.DUMMY
            );
    }

    static async fromConfig(
        accountId: string,
        config: Config,
        targetsRepository: NotificationTargetsRepository
    ): Promise<TargetResolver> {
        const [
            repoClient,
            accountServiceClient,
            userServiceClient,
        ] = await Promise.all([
            BackendRepoServiceClient.fromConfig(config, "notification-service"),
            BackendAccountServiceClient.fromConfig(config, "notification-service"),
            BackendUserServiceClient.fromConfig(config, "notification-service")
        ]);

        return new TargetResolver(
            accountId,
            accountServiceClient,
            targetsRepository,
            repoClient,
            userServiceClient
        );
    }

}
