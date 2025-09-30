import {
    Acl,
    AssigneeGroup,
    AssigneeType,
    AuthorizationServiceContract,
    PermissionName,
    ResourceGroup,
    ResourceType
} from  "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Logger, LoggerBuilder } from "../../util/logging";
import { filterAclsByAssignees, permissionNamesForAcls } from "../helpers/acls";
import { AclResourcesStore } from "../stores/aclresources/aclresourcesstore";
import { AclsStore } from "../stores/acls/aclstore";
import { AncestorsCache } from "./ancestors";
import { Config } from "@binders/client/lib/config/config";
import { UnCachedBackendAuthorizationServiceClient } from "../../authorization/backendclient";
import { UserGroupsCache } from "./usergroups";
import { createPermanentCacheRedis } from "../stores/redis";
import { filterResourceGroups } from "../helpers/resourcegroups";
import { flatten } from "ramda";
import { getAssignees } from "../helpers/assignees";
import { getResourceGroups } from "../helpers/getresources";

export class AclsCache {

    constructor(
        private readonly aclResourcesStore: AclResourcesStore,
        private readonly aclsStore: AclsStore,
        private readonly authorizationService: AuthorizationServiceContract,
        private readonly userGroupsCache: UserGroupsCache,
        private readonly ancestorsCache: AncestorsCache,
        private readonly logger: Logger
    ) { }

    async findResourcePermissionsWithRestrictions(
        accountId: string,
        userId: string,
        resourceType: ResourceType,
        resourceId: string
    ): Promise<Acl[]> {
        return this.findUserAcls(
            accountId,
            userId,
            resourceType,
            resourceId
        );
    }

    async findResourcePermissions(
        accountId: string,
        userId: string,
        resourceType: ResourceType,
        resourceId: string
    ): Promise<PermissionName[]> {
        const acls = await this.findUserAcls(
            accountId,
            userId,
            resourceType,
            resourceId
        );
        return permissionNamesForAcls(acls);
    }

    private async findUserAcls(
        accountId: string,
        userId: string,
        resourceType: ResourceType,
        resourceId: string
    ): Promise<Acl[]> {
        const assignees = await this.fetchUserAssignees(accountId, userId);
        const resources = await this.fetchResourcesWithAncestors(
            resourceType,
            resourceId
        );
        return await this.findAclMatches(accountId, assignees, resources);
    }

    private fetchResourcesWithAncestors(
        resourceType: ResourceType,
        resourceId: string
    ): Promise<ResourceGroup[]> {
        const fetchAncestorIds = async (itemId: string) => {
            const ancestors = await this.ancestorsCache.getItemsAncestors([itemId]);
            return Object.keys(ancestors);
        }
        return getResourceGroups(
            resourceType,
            resourceId,
            fetchAncestorIds
        );
    }

    private fetchUserAssignees(
        accountId: string,
        userId: string
    ): Promise<AssigneeGroup[]> {
        const fetchGroupIds = async (accountId: string, userId: string) => {
            const groups = await this.userGroupsCache.fetchUserGroup(
                accountId,
                userId
            );
            return groups.map(g => g.id);
        }
        return getAssignees(
            accountId,
            AssigneeType.USER,
            userId,
            fetchGroupIds
        );
    }

    private async findAclMatches(
        accountId: string,
        assignees: AssigneeGroup[],
        resources: ResourceGroup[]
    ): Promise<Acl[]> {
        const resourcesWithAcl = await this.filterResoureGroupsWithoutAcl(
            accountId,
            resources
        );
        if (resourcesWithAcl == null || resourcesWithAcl.length === 0) {
            // This happens when there are no ACLs for the given resources.
            // usually because the resources are not linked to the root collection.
            this.logger.error(
                `No ACLs found for resources with ids ${resources.map(r => r.id).join(", ")}`,
                "acls-cache"
            );
            return [];
        }

        const acls = await this.fetchAclsForResourceGroups(resourcesWithAcl);
        return filterAclsByAssignees(assignees, acls);
    }

    private async fetchAclsForResourceGroups(resourceGroups: ResourceGroup[]): Promise<Acl[]> {
        const {
            acls: cachedAcls,
            notFoundResources
        } = await this.aclsStore.fetchCachedAclsForResourceGroups(
            resourceGroups
        );

        if (notFoundResources.length === 0) {
            return cachedAcls;
        }

        const acls = await this.authorizationService.allResourceAcls(
            notFoundResources
        );
        const groupedAcls = acls.reduce<{ [resId: string]: Acl[] }>((grouped, acl) => {
            const resIds = flatten(acl.rules.map(rule => rule.resource.ids))
            for (const resId of resIds) {
                if (grouped[resId] == null) {
                    grouped[resId] = [];
                }
                grouped[resId].push(acl);
            }
            return grouped;
        }, {});
        this.aclsStore.cacheAclsForResourceIds(groupedAcls);

        return [...cachedAcls, ...acls];
    }

    private async filterResoureGroupsWithoutAcl(
        accountId: string,
        resourceGroups: ResourceGroup[]
    ): Promise<ResourceGroup[]> {
        return filterResourceGroups(
            resourceGroups,
            (resourceIds) => this.filterResourceIdsWithoutAcl(
                accountId,
                resourceIds
            )
        );
    }

    private async filterResourceIdsWithoutAcl(
        accountId: string,
        resourceIds: string[]
    ): Promise<string[]> {
        if (await this.aclResourcesStore.hasResourceIdsForAccount(accountId)) {
            return this.aclResourcesStore.filterResourceIdsWithoutAcl(
                accountId,
                resourceIds
            );
        }

        const resIdsWithAcl = await this.authorizationService.allResourceIdsForAccounts(
            [accountId]
        );

        this.aclResourcesStore.cacheIdsWithAclForAccount(
            accountId,
            resIdsWithAcl[accountId]
        );
        const resIdsSet = new Set(resIdsWithAcl[accountId]);
        return resourceIds.filter(id => resIdsSet.has(id));
    }

    static async fromConfig(config: Config): Promise<AclsCache> {
        const redisClient = createPermanentCacheRedis(config);
        return new AclsCache(
            new AclResourcesStore(redisClient),
            new AclsStore(redisClient),
            await UnCachedBackendAuthorizationServiceClient.fromConfig(config, "acls-cache"),
            await UserGroupsCache.fromConfig(config),
            await AncestorsCache.fromConfig(config),
            LoggerBuilder.fromConfig(config, "acls-cache"),
        );
    }
}
