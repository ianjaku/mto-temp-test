/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
    APIEntityMapperFactory,
    EntityMapper,
    EntityMapperFactory,
    getContainingResourceTypes
} from "./entitymapper";
import {
    AccountIdentifier,
    AclIdentifier,
    RoleIdentifier
} from "@binders/binders-service-common/lib/authentication/identity";
import {
    AccountRoles,
    getDefaultAccountRoles,
    getDocumentResourcePermissionsFromRole
} from "./roles";
import {
    AccountsWithPermissions,
    AssigneeGroup,
    AssigneeType,
    AuthorizationAccess,
    AuthorizationServiceContract,
    Acl as ClientAcl,
    IAclRestrictionSet,
    IResourceGroupsFilter,
    IncludePublicPolicy,
    Permission,
    PermissionMap,
    PermissionName,
    ResourceGroup,
    ResourceIdPermissionsName,
    ResourcePermission,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Acl, publicAssignee } from "./models/acl";
import { Repository as AclRepository, AclRepositoryFactory } from "./repositories/acl";
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    Logger,
    LoggerBuilder
} from "@binders/binders-service-common/lib/util/logging";
import { RoleRepository, RoleRepositoryFactory, builtInRoles } from "./repositories/roles";
import { any, flatten, intersection, splitEvery } from "ramda";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BinderFilter } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { Config } from "@binders/client/lib/config/config";
import { Maybe } from "@binders/client/lib/monad";
import { RedisPermissionsRepository } from "./repositories/redisPermissionsRepository";
import { Role } from "./models/roles";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { hasPublic } from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import { scorePermission } from "@binders/client/lib/clients/authorizationservice/v1/util";

class AdminAclNotFound extends Error {
    static NAME = "AdminAclNotFound";

    constructor(accountId: string) {
        super(`Could not find admin acl or account ${accountId}`);
        this.name = AdminAclNotFound.NAME;
    }
}

const getBindersMediaAccountId = async () => {
    return "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6";
};

const toClientAcl = (acl: Acl): ClientAcl => {
    return {
        id: acl.id.value(),
        name: acl.name,
        description: acl.description,
        accountId: acl.accountId.value(),
        rules: acl.rules,
        assignees: acl.assignees,
        roleId: acl.roleId,
        restrictionSet: acl.restrictionSet,
    };
};


function filterAclByMaxPermission(permission: PermissionName): (acl: Acl) => boolean {
    const targetScore = scorePermission(permission);
    return function (acl: Acl): boolean {
        const ruleScores = acl.rules.map(rule => {
            const permissionScores = rule.permissions.map(p => scorePermission(p.name));
            return Math.max(...permissionScores);
        });
        return Math.max(...ruleScores) === targetScore;
    };
}
const toModelAcl = (acl: ClientAcl): Acl => {
    const aclIdentifier = new AclIdentifier(acl.id);
    const accountIdObject = new AccountIdentifier(acl.accountId);
    if (acl.description === undefined) {
        acl.description = "";
    }
    return new Acl(aclIdentifier, acl.name, acl.description, accountIdObject, acl.assignees, acl.rules, acl.roleId, acl.restrictionSet);
};


const reduceToPermissionNames = (resourcePermissions: ResourcePermission[]): PermissionName[] => {
    const allPermissionNames = new Set<PermissionName>();
    for (const resourcePermission of resourcePermissions) {
        resourcePermission.permissions.forEach(permission => allPermissionNames.add(permission.name));
    }
    return Array.from(allPermissionNames);
};

export class AuthorizationService implements AuthorizationServiceContract {

    constructor(
        private readonly aclRepository: AclRepository,
        private readonly roleRepository: RoleRepository,
        private readonly entityMapper: EntityMapper,
        private readonly repoServiceContract: BinderRepositoryServiceClient,
        private readonly accountServiceClient: AccountServiceClient,
        private readonly logger: Logger,
        private readonly redisPermissionsRepository: RedisPermissionsRepository,
        private readonly userServiceClient: UserServiceClient,
    ) {
        this.logger = logger;
        this.aclRepository = aclRepository;
        this.roleRepository = roleRepository;
    }

    private extractReadAcl(acls: Acl[]): Maybe<Acl> {
        const matches = acls.filter(acl => {
            const readonlyRules = acl.rules.filter(rule => {
                return rule.permissions.length === 1 && rule.permissions[0].name === PermissionName.VIEW;
            });
            // const documentOnlyRules = acl.rules.filter(rule => {
            //     return rule.resource.type === ResourceType.DOCUMENT;
            // });
            return readonlyRules.length === 1;
        });
        if (matches.length === 0) {
            return Maybe.nothing<Acl>();
        }
        if (matches.length > 1) {
            this.logger.error("Multiple readonly acls found", "az-service-filter", matches);
            throw new Error(`Multiple readonly acls found: ${matches.map(m => m.id)}`);
        }
        return Maybe.just(matches[0]);
    }

    private findDocumentViewAcl(accountId, documentId): Promise<Maybe<Acl>> {
        const documentGroup = { type: ResourceType.DOCUMENT, ids: [documentId] };
        return this.aclRepository.findAclMatches([], [documentGroup], [PermissionName.VIEW], accountId)
            .then(acls => this.extractReadAcl(acls));
    }

    async grantPublicReadAccess(
        accountId: string,
        documentId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<ClientAcl> {
        const aclOption = await this.findDocumentViewAcl(accountId, documentId);
        const aclToUpdate = aclOption.isJust() ?
            aclOption.get() :
            await this.newDocumentAclBuilder(accountId, documentId, builtInRoles.readers);
        const acl = aclToUpdate.addPublicAssignee();
        const newAcl = await this.aclRepository.updateAcl(acl, acl.id);
        if (typeof auditLogCallback === "function") {
            auditLogCallback(toClientAcl(newAcl), toClientAcl(acl));
        }
        await this.accountServiceClient.updateTotalPublicDocumentLicensing(accountId,);
        await this.repoServiceContract.invalidatePublicItemsForAccount(accountId);
        return toClientAcl(newAcl);
    }

    private async newDocumentAclBuilder(accountId: string, documentId: string, role: Role, aclRestrictionSet?: IAclRestrictionSet): Promise<Acl> {
        const aclId = AclIdentifier.generate();
        const name = `${role.name} on ${documentId}`;
        const rules = [getDocumentResourcePermissionsFromRole(documentId, role)];
        return new Acl(aclId, name, name, new AccountIdentifier(accountId), [], rules, role.roleId, aclRestrictionSet);
    }

    async canAccessBackend(userId?: string): Promise<boolean> {
        if (!userId) {
            throw new Unauthorized("Must be logged in before you can access the backend.");
        }
        const bindersAccount = await getBindersMediaAccountId();
        const resourceGroups = await this.findAllowedResourceGroups(
            userId, ResourceType.ACCOUNT, PermissionName.EDIT, false, bindersAccount
        );
        return resourceGroups.length > 0;
    }

    async revokePublicReadAccess(
        accountId: string,
        documentId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<ClientAcl> {
        const aclOption = await this.findDocumentViewAcl(accountId, documentId);
        const aclToUpdate = aclOption.isJust() ?
            aclOption.get() :
            await this.newDocumentAclBuilder(accountId, documentId, builtInRoles.readers);
        const acl = aclToUpdate.removePublicAssignee();
        const newAcl = await this.aclRepository.updateAcl(acl, acl.id);
        if (typeof auditLogCallback === "function") {
            auditLogCallback(toClientAcl(newAcl), toClientAcl(acl));
        }
        await this.accountServiceClient.updateTotalPublicDocumentLicensing(accountId);
        await this.repoServiceContract.invalidatePublicItemsForAccount(accountId);
        return toClientAcl(newAcl);
    }

    async allResourceAcls(
        resourceGroups: ResourceGroup[],
        accountId: string
    ): Promise<ClientAcl[]> {
        const acls = await this.findAclMatches(
            [],
            resourceGroups,
            accountId
        );
        return acls.map(toClientAcl);
    }

    async resourceAcls(resourceGroup: ResourceGroup, accountId?: string, userId?: string, isBackend?: boolean): Promise<{ [key: string]: ClientAcl[] }> {
        if (!userId) {
            throw new Unauthorized("Unknown user.");
        }
        if (resourceGroup.ids.length === 0) {
            throw new Error("Invalid request. Missing resource id.");
        }
        const assignees = await this.entityMapper.getAssignees(AssigneeType.USER, userId, accountId);
        // Fetch the resource hierarchies
        const allResources = await this.entityMapper.getResourcesArray(resourceGroup.type, resourceGroup.ids);

        // Build set of unique document ids from the hierarchies
        const uniqueResourceIdSet = new Set<string>();
        for (const withAncestors of allResources) {
            withAncestors.ids.forEach(id => uniqueResourceIdSet.add(id));
        }
        const uniqueResourceIds = Array.from<string>(uniqueResourceIdSet);
        // Fetch the acls matching the ids
        const relevantAcls = await this.findAclMatches([], [{ type: resourceGroup.type, ids: uniqueResourceIds }], accountId);
        function filterAclsForResource(hierarchy: string[]) {
            return relevantAcls.filter(acl => any(
                rule => (
                    any(id => hierarchy.includes(id), rule.resource.ids)
                ),
                acl.rules
            ));
        }
        function hasAdmin(acls: Acl[]): boolean {
            return any(
                (acl: Acl) => any(
                    (rule: ResourcePermission) => any(
                        (permission: Permission) => permission.name === PermissionName.ADMIN,
                        rule.permissions
                    ),
                    acl.rules
                ),
                acls
            );
        }

        // Filter based on assignees (if !backend and !hasAdmin)
        function filterAclsByAssignee(acls: Acl[]) {
            if (isBackend || hasAdmin(acls)) {
                return acls;
            }
            return acls.filter(acl => {
                any(
                    assignee => (
                        any(
                            // MT-3388 [fix] - AssigneeGroup does not have property `id: string`, instead it is `ids: string[]`
                            a => a.type === assignee.type && undefined === undefined, // a.id === assignee.id,
                            assignees
                        )
                    ),
                    acl.assignees
                )
            });
        }

        // Return ACLs per resourceId
        const result = {};
        resourceGroup.ids.forEach((resourceId, j) => {
            const hierarchy = allResources[j].ids;
            const aclsForResource = filterAclsForResource(hierarchy);
            result[resourceId] = filterAclsByAssignee(aclsForResource)
                .map(toClientAcl);
        });
        return result;
    }

    async findMyResourceGroups(
        accountIds: string[],
        resourceType: ResourceType,
        permissionNames: PermissionName[],
        filter?: IResourceGroupsFilter,
        userId?: string
    ): Promise<PermissionMap[]> {
        const includePublicPolicy = filter && filter.includePublic;
        if (userId) {
            let assignees = [];
            for (const accountId of accountIds) {
                assignees = [
                    ...assignees,
                    ...(await this.entityMapper.getAssignees(AssigneeType.USER, userId, accountId))
                ]
            }
            if (includePublicPolicy === IncludePublicPolicy.EXCLUDE) {
                assignees = assignees.filter(a => a.type !== AssigneeType.PUBLIC);
            }
            const resourceTypes = getContainingResourceTypes(resourceType);

            const resourceGroupsMap = {};
            await Promise.all(
                permissionNames.map(async permissionName => {
                    const resourceGroupsWithKey = await this.aclRepository.findResourceGroups(assignees, resourceTypes, permissionName, accountIds);
                    resourceGroupsMap[permissionName] = [...((resourceGroupsMap[permissionName]) || []), ...resourceGroupsWithKey];
                })
            );
            const result: PermissionMap[] = [];
            // if empty array, there are no edit permissions on anything, dont include it
            for (let i = 0; i < permissionNames.length; i++) {
                const resourceGroupsWithKey = resourceGroupsMap[permissionNames[i]];
                if (resourceGroupsWithKey.length > 0) {
                    result[i] = { permission: permissionNames[i], resources: resourceGroupsWithKey };
                }
            }
            return result.filter(entry => !!entry);
        } else {
            return this.findPublicResourceGroups(resourceType, permissionNames, accountIds, includePublicPolicy === IncludePublicPolicy.INCLUDE_EXCEPT_ADVERTIZED);
        }
    }


    private async findAdminAcls(accountId) {
        const logger = this.logger;
        const rootCollections = await this.repoServiceContract.getRootCollections([accountId]);
        if (rootCollections === undefined || rootCollections.length === 0) {
            throw new Error("Could not find root collection for " + accountId);
        }
        const [documentAcls, accountAcls] = await Promise.all([
            // todo: should change it with roles probably?
            this.aclRepository.findAclMatches([], [{ type: ResourceType.DOCUMENT, ids: [<string>rootCollections[0].id] }], [PermissionName.ADMIN], accountId),
            this.aclRepository.findAclMatches([], [{ type: ResourceType.ACCOUNT, ids: [accountId] }], [PermissionName.EDIT], accountId)
        ]);
        if (documentAcls.length !== 1) {
            logger.error(`Wrong number of document admin acls ${documentAcls.length} for ${accountId}`, "add-admin");
            throw Error("Could not add admin: doc acls");
        }
        if (accountAcls.length !== 1) {
            logger.error(`Wrong number of account admin acls ${accountAcls.length} for ${accountId}`, "add-admin");
            throw Error("Could not add admin: account acls");
        }
        return [documentAcls[0], accountAcls[0]];
    }


    async addAccountAdminUserGroup(accountId: string, groupId: string) {
        const addAssignee = async (acl: Acl) => {
            const updatedAcl = acl.addAssignee(AssigneeType.USERGROUP, groupId);
            const newAcl = await this.aclRepository.updateAcl(updatedAcl, updatedAcl.id);
            return newAcl;
        };

        const [documentAcl, accountAcl] = await this.findAdminAcls(accountId);
        return Promise.all([
            addAssignee(accountAcl),
            addAssignee(documentAcl)
        ]).then(([updateAccountAcl]) => updateAccountAcl.getUsergroupAssignees());
    }

    async addAccountAdmin(
        accountId: string,
        userId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<string[]> {
        await this.removeAssigneeFromAccount(accountId, AssigneeType.USER, userId);
        const addAssignee = async (acl: Acl) => {
            const updatedAcl = acl.addAssignee(AssigneeType.USER, userId);
            const newAcl = await this.aclRepository.updateAcl(updatedAcl, updatedAcl.id);
            if (typeof auditLogCallback === "function") {
                auditLogCallback(toClientAcl(newAcl), toClientAcl(acl));
            }
            this.redisPermissionsRepository.invalidatePermissionsForUser(userId);
            return newAcl;
        };

        const [documentAcl, accountAcl] = await this.findAdminAcls(accountId);
        return Promise.all([
            addAssignee(accountAcl),
            addAssignee(documentAcl)
        ]).then(([updateAccountAcl]) => updateAccountAcl.getUserAssignees());
    }

    async addAclAssignee(
        aclId: string,
        accountId: string,
        assigneeType: AssigneeType,
        assigneeId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<ClientAcl> {
        const acl = await this.aclRepository.getAcl(new AclIdentifier(aclId));
        const updatedAcl = acl.addAssignee(assigneeType, assigneeId);
        const newAcl = await this.aclRepository.updateAcl(updatedAcl, updatedAcl.id);
        if (typeof auditLogCallback === "function") {
            auditLogCallback(toClientAcl(newAcl), toClientAcl(acl));
        }
        this.invalidatePermissionsFromAclIfNeeded(newAcl);
        return toClientAcl(newAcl);
    }

    async updateAclAssignee(
        oldAlcId: string,
        aclId: string,
        accountId: string,
        assigneeType: AssigneeType,
        assigneeId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<ClientAcl> {
        const oldAcl = await this.aclRepository.getAcl(new AclIdentifier(oldAlcId));
        const acl = await this.aclRepository.getAcl(new AclIdentifier(aclId));
        const addedAssignee = acl.addAssignee(assigneeType, assigneeId);
        const addedAssigneeAcl = await this.aclRepository.updateAcl(addedAssignee, addedAssignee.id);
        const removedAssignee = oldAcl.removeAssignee(assigneeType, assigneeId);
        const removedAssignedAcl = await this.aclRepository.updateAcl(removedAssignee, removedAssignee.id);
        if (typeof auditLogCallback === "function") {
            auditLogCallback(toClientAcl(addedAssigneeAcl), toClientAcl(removedAssignedAcl));
        }
        this.invalidatePermissionsFromAclIfNeeded(addedAssigneeAcl);
        this.invalidatePermissionsFromAclIfNeeded(removedAssignedAcl);
        return toClientAcl(addedAssigneeAcl);
    }

    async duplicateResourceAcls(
        fromToIdPairs: string[][],
        resourceType: ResourceType,
        accountId: string,
    ): Promise<void> {
        const itemPairBatches = splitEvery(10, fromToIdPairs);
        for await (const itemPairBatch of itemPairBatches) {
            await Promise.all(itemPairBatch.map(([fromId, toId]) => {
                return this.aclRepository.duplicateAcl(fromId, toId, resourceType, accountId);
            }));
        }
    }

    private async getAclForRole(accountId, defaultRole: Role) {
        const rootCollections = await this.repoServiceContract.getRootCollections([accountId]);
        if (rootCollections === undefined || rootCollections.length === 0 || rootCollections[0].id === undefined) {
            throw new Error("Root collection not found for account: " + accountId);
        }
        const aclOption = await this.findDocumentAclByMaxPermission(accountId, rootCollections[0].id as string, defaultRole.permissions[0]);
        if (aclOption.isNothing()) {
            throw new Error("Could not find reader acl on root collection.");
        }
        return aclOption.get();
    }

    private async getDefaultAcls(accountId: string): Promise<Acl[]> {
        const accountDefaultRole = await this.getAccountDefaultRole(accountId);
        return Promise.all([this.getAclForRole(accountId, accountDefaultRole)]);
    }

    async allResourceIdsForAccounts(
        accountIds: string[]
    ): Promise<{ [accountId: string]: string[] }> {
        const resourceIds = {};
        for (const accountId of accountIds) {
            const acls = await this.aclRepository.accountAcls(
                new AccountIdentifier(accountId)
            );
            const ids = acls.reduce((ids, acl) => (
                acl.rules.reduce((aclResourceIds, rule) => (
                    [...aclResourceIds, ...rule.resource.ids]
                ), ids)
            ), []);
            resourceIds[accountId] = ids;
        }
        return resourceIds;
    }

    async addUserToAccount(
        accountId: string,
        userId: string,
        fromUserId?: string,
        fromUserIp?: string | string[],
        fromUserAgent?: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<void> {
        const existingAcls = await this.getDefaultAcls(accountId);
        const updatedAcls = existingAcls.map(acl => acl.addAssignee(AssigneeType.USER, userId));
        for (const aclIndex in updatedAcls) {
            const oldAcl = existingAcls[aclIndex];
            const updatedAcl = updatedAcls[aclIndex];
            const newAcl = await this.aclRepository.updateAcl(updatedAcl, updatedAcl.id);
            if (typeof auditLogCallback === "function") {
                auditLogCallback(toClientAcl(newAcl), toClientAcl(oldAcl));
            }
            this.redisPermissionsRepository.invalidatePermissionsForUser(userId);
        }
    }

    async removeAclAssignee(
        aclId: string,
        accountId: string,
        assigneeType: AssigneeType,
        assigneeId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<ClientAcl> {
        const acl = await this.aclRepository.getAcl(new AclIdentifier(aclId));
        const updatedAcl = acl.removeAssignee(assigneeType, assigneeId);
        if (updatedAcl.assignees.length === 0 && updatedAcl.name === builtInRoles.admins.pluralName) {
            return Promise.reject(new Error("Cannot remove the last account admin"));
        }
        if (typeof auditLogCallback === "function") {
            auditLogCallback(toClientAcl(updatedAcl), toClientAcl(acl));
        }
        const modelAcl = await this.aclRepository.updateAcl(updatedAcl, updatedAcl.id);
        this.invalidateAssignees(acl);
        return toClientAcl(modelAcl);
    }

    async getAccountAdmins(accountId: string): Promise<string[]> {
        const adminAcl = await this.getAdminAcl(accountId);
        return adminAcl.getUserAssignees();
    }

    async removeAccountAdmin(
        accountId: string,
        userId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<string[]> {
        const removeAssignee = async (acl: Acl) => {
            const updatedAcl = acl.removeAssignee(AssigneeType.USER, userId);
            const newAcl = await this.aclRepository.updateAcl(updatedAcl, updatedAcl.id);
            if (typeof auditLogCallback === "function") {
                auditLogCallback(toClientAcl(newAcl), toClientAcl(acl));
            }
            this.redisPermissionsRepository.invalidatePermissionsForUser(userId);
            return newAcl;
        };

        const [documentAcl, accountAcl] = await this.findAdminAcls(accountId);
        return Promise.all([
            removeAssignee(accountAcl),
            removeAssignee(documentAcl)
        ]).then(([updateAccountAcl]) => updateAccountAcl.getUserAssignees());
    }

    removeUserFromAccount(
        accountId: string,
        userId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<void> {
        return this.removeAssigneeFromAccount(accountId, AssigneeType.USER, userId, auditLogCallback);
    }

    async removeAssigneeFromAccount(
        accountId: string,
        assigneeType: AssigneeType,
        assigneeId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<void> {
        const acls = await this.aclRepository.accountAcls(new AccountIdentifier(accountId));
        const aclsToUpdate = acls.filter(acl => {
            const assigneeGroups: AssigneeGroup[] = acl.assignees.filter(assignee => assignee.type === assigneeType);
            const assigneeGroupsContainingAssignee = assigneeGroups.filter(assigneeGroup => assigneeGroup.ids.filter(id => id === assigneeId).length > 0);
            return assigneeGroupsContainingAssignee.length > 0;
        });
        const updatedAcls = aclsToUpdate.map(aclToUpdate => aclToUpdate.removeAssignee(assigneeType, assigneeId));
        for (const acl of updatedAcls) {
            const newAcl = await this.aclRepository.updateAcl(acl, acl.id);
            if (typeof auditLogCallback === "function") {
                const oldAcl = acls.find(a => a.id.value() === acl.id.value());
                auditLogCallback(toClientAcl(newAcl), toClientAcl(oldAcl));
            }
        }

        if (AssigneeType.USER === assigneeType) {
            this.redisPermissionsRepository.invalidatePermissionsForUser(assigneeId);
        }
    }

    removeUsergroupFromAccount(accountId: string, groupId: string): Promise<void> {
        return this.removeAssigneeFromAccount(accountId, AssigneeType.USERGROUP, groupId);
    }


    async handleCacheOnGroupMemberRemoval(
        accountId: string,
        groupId: string,
        membersIds: string[],
        forceFlush = false
    ) {
        const userIdsToInvalidate = [];
        if (forceFlush) {
            userIdsToInvalidate.push(...membersIds);
        } else {
            const groupAcls = await this.aclRepository.getAclsForAccountGroup(accountId, groupId);
            for (const groupAcl of groupAcls) {
                if (this.hasAclAdminOrEditors(groupAcl)) {
                    userIdsToInvalidate.push(...membersIds);
                }
            }
        }
        for (const userId of userIdsToInvalidate) {
            this.redisPermissionsRepository.invalidatePermissionsForUser(userId);
        }
    }

    findAclMatches(assignees: AssigneeGroup[], resources: ResourceGroup[], accountId?: string): Promise<Acl[]> {
        if (assignees.length === 0 && resources.length === 0) {
            this.logger.debug("No assignees, nor resources. Shortcutting.", "access-invalid-request");
            return Promise.resolve([]);
        }
        return this.aclRepository.findAclMatches(assignees, resources, [], accountId);
    }

    async findAllowedResourceGroups(
        userId: string,
        resourceType: ResourceType,
        permission: PermissionName,
        skipPublic: boolean,
        accountId: string,
    ): Promise<ResourceGroup[]> {
        const resourceTypes = getContainingResourceTypes(resourceType);
        const repo = this.aclRepository;
        let assignees = await this.entityMapper.getAssignees(AssigneeType.USER, userId, accountId);
        if (skipPublic) {
            assignees = assignees.filter(a => a.type !== AssigneeType.PUBLIC);
        }
        return repo.findResourceGroups(assignees, resourceTypes, permission, [accountId]);
    }

    findPublicPermissions(resourceType: ResourceType, resourceId: string, accountId: string): Promise<PermissionName[]> {
        return this.findPermissionsForResource([publicAssignee()], resourceType, resourceId, accountId);
    }

    findPublicResourceGroups(resourceType: ResourceType, permissions: PermissionName[], accountIds?: string[], excludeAdvertized?: boolean): Promise<PermissionMap[]> {
        const resourceTypes = getContainingResourceTypes(resourceType);
        return Promise.all(permissions.map(async permission => {
            const resources = await this.aclRepository.findResourceGroups([publicAssignee()], resourceTypes, permission, accountIds);
            if (excludeAdvertized) {
                const documentResource = resources.find(r => r.type === ResourceType.DOCUMENT);
                if (documentResource) {
                    const { ids } = documentResource;
                    const itemFilter: BinderFilter = {
                        binderIds: ids,
                        showInOverview: true,
                    }
                    const pubAdvItems = await this.repoServiceContract.findItems(itemFilter, { maxResults: 10000 });
                    const pubAdvIds = pubAdvItems.map(i => i.id);
                    documentResource.ids = intersection(ids, pubAdvIds);
                }
            }
            return {
                permission,
                resources
            };
        }));
    }

    private findPermissionsForResource(assignees: AssigneeGroup[], resourceType: ResourceType, resourceId: string, accountId: string): Promise<PermissionName[]> {
        const findMatches = this.findAclMatches.bind(this);
        return (this.entityMapper
            .getResources(resourceType, resourceId)
            .then(resourceParents => findMatches(assignees, resourceParents, accountId))
            .then(matches => matches.map(match => match.rules))
            // flatten the nested rules to a 1d array
            // eslint-disable-next-line prefer-spread
            .then(nestedRules => [].concat.apply([], nestedRules))
            .then(reduceToPermissionNames));
    }

    private findPermissionsWithRestrictionSetForResource(assignees: AssigneeGroup[], resourceType: ResourceType, resourceId: string, accountId: string): Promise<ClientAcl[]> {
        const findMatches = this.findAclMatches.bind(this);
        return this.entityMapper
            .getResources(resourceType, resourceId)
            .then(resourceParents => findMatches(assignees, resourceParents, accountId))
            .then(matches => matches.map(toClientAcl))
            // flatten the nested rules to a 1d array
            // eslint-disable-next-line prefer-spread
            .then(nestedRules => [].concat.apply([], nestedRules))
    }


    private async findMultiplePermissionsForResources(assignees: AssigneeGroup[], resourceType: ResourceType, resourceIds: string[], accountId: string): Promise<ResourceIdPermissionsName> {
        const resourcesArray = await this.entityMapper.getResourcesArray(resourceType, resourceIds);
        const aclMatches = await this.findAclMatches(assignees, resourcesArray, accountId);

        return resourcesArray.reduce((acc, resource) => {
            const matchesForResource = aclMatches.filter(acl => {
                const doesAclApplyToOneOfTheParents = intersection(resource.ids, flatten(acl.rules.map(r => r.resource.ids)));
                return doesAclApplyToOneOfTheParents.length > 0;
            })
            const aclRules = matchesForResource.map(match => match.rules);
            const flattenRules = flatten(aclRules);
            acc[resource.id] = reduceToPermissionNames(flattenRules);
            return acc;
        }, {})
    }

    async findResourcePermissions(
        userId: string,
        resourceType: ResourceType,
        resourceId: string,
        accountId?: string
    ): Promise<PermissionName[]> {
        return this.entityMapper
            .getAssignees(AssigneeType.USER, userId, accountId)
            .then(assignees => (
                this.findPermissionsForResource(assignees, resourceType, resourceId, accountId)
            ));
    }

    findResourcePermissionsWithRestrictions(
        userId: string,
        resourceType: ResourceType,
        resourceId: string,
        accountId?: string
    ): Promise<ClientAcl[]> {
        return this.entityMapper
            .getAssignees(AssigneeType.USER, userId)
            .then(assignees => this.findPermissionsWithRestrictionSetForResource(assignees, resourceType, resourceId, accountId));
    }

    async findMultipleResourcesPermissions(userId: string, resourceType: ResourceType, resourceIds: string[], accountId?: string): Promise<ResourceIdPermissionsName> {
        let assignees: AssigneeGroup[]
        if (userId) {
            assignees = await this.entityMapper.getAssignees(AssigneeType.USER, userId)
        } else {
            assignees = [publicAssignee()]
        }
        return this.findMultiplePermissionsForResources(assignees, resourceType, resourceIds, accountId);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    authorize(userId, accountIds, resourcePermission): Promise<AuthorizationAccess> {
        throw new Error("Not implemented");
    }

    private async getAdminAcl(accountId: string): Promise<Acl> {
        const candidates = await this.findAclMatches([], [{ type: ResourceType.ACCOUNT, ids: [accountId] }], accountId);
        const aclOption = this.extractAclByMaxPermission(candidates, PermissionName.EDIT);
        if (aclOption.isNothing()) {
            throw new AdminAclNotFound(accountId);
        }
        return aclOption.get();
    }

    createDefaultAccountRoles(accountId: string, collectionId: string): Promise<ClientAcl[]> {
        const roles: AccountRoles = getDefaultAccountRoles(accountId, collectionId);
        const promises: Promise<ClientAcl>[] = [];
        return this.getAdminAcl(accountId).then(() => [], error => {
            if (error.name === AdminAclNotFound.NAME) {
                for (const role in roles) {
                    const acls: Acl[] = roles[role];
                    acls.forEach(acl => {
                        promises.push(this.createAcl(acl.name, acl.description, acl.accountId.value(), acl.assignees, acl.rules, acl.roleId));
                    });
                }
                return Promise.all(promises);
            }
            throw error;
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    loadAcl(aclId: string, accountId: string): Promise<ClientAcl> {
        // TODO: add validation
        const aclIdObject = new AclIdentifier(aclId);
        return this.aclRepository.getAcl(aclIdObject).then(acl => {
            return toClientAcl(acl);
        });
    }

    accountAcls(accountId: string): Promise<Array<ClientAcl>> {
        const accountIdObject = new AccountIdentifier(accountId);
        return this.aclRepository.accountAcls(accountIdObject).then(acls => acls.map(toClientAcl));
    }

    async userDocumentsAcls(userAndGroupIds: string[], accountId: string): Promise<ClientAcl[]> {
        const roles = await this.allRolesForAccount(accountId);
        const accountIdObject = new AccountIdentifier(accountId);
        const acls = await this.aclRepository.userAcls(accountIdObject, userAndGroupIds, ResourceType.DOCUMENT);
        return acls
            .map(acl => ({ ...acl, roleId: roles.find(role => role.roleId === acl.roleId).name }))
            .map(toClientAcl);
    }

    async createAcl(
        name: string,
        description: string,
        accountId: string,
        assignees: AssigneeGroup[],
        rules: Array<ResourcePermission>,
        roleId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<ClientAcl> {
        const idObject = AclIdentifier.generate();
        const accountIdObj = new AccountIdentifier(accountId);
        // TODO: add validation
        const acl = new Acl(idObject, name, description, accountIdObj, assignees, rules, roleId);
        const modelAcl = await this.aclRepository.createAcl(acl);
        const clientAcl = toClientAcl(modelAcl);
        if (typeof auditLogCallback === "function") {
            auditLogCallback(clientAcl);
        }
        this.invalidatePermissionsFromAclIfNeeded(modelAcl);
        this.repoServiceContract.invalidatePublicItemsForAccount(accountId);
        return clientAcl;
    }

    async updateAcl(
        toUpdate: ClientAcl,
        aclId?: string,
        accountId?: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<ClientAcl> {
        // TODO: add validation
        if (aclId === undefined) {
            aclId = toUpdate.id;
        }
        if (accountId === undefined) {
            return Promise.reject(new Error("Need an accountId to update the acl"));
        }
        const aclIdObject = new AclIdentifier(aclId);
        toUpdate.accountId = accountId;
        const modelAcl = await this.aclRepository.updateAcl(toModelAcl(toUpdate), aclIdObject);
        const newAcl = toClientAcl(modelAcl);
        if (typeof auditLogCallback === "function") {
            auditLogCallback(newAcl, toUpdate);
        }
        this.invalidatePermissionsFromAclIfNeeded(modelAcl);
        this.repoServiceContract.invalidatePublicItemsForAccount(accountId);
        return newAcl;
    }

    async deleteAcl(
        aclId: string,
        accountId: string,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void,
    ): Promise<void> {
        // TODO: add validation
        const aclIdObject = new AclIdentifier(aclId);
        const oldAcl = await this.aclRepository.getAcl(aclIdObject);
        if (typeof auditLogCallback === "function") {
            auditLogCallback(undefined, toClientAcl(oldAcl));
        }
        await this.aclRepository.deleteAcl(aclIdObject);
        this.invalidatePermissionsFromAclIfNeeded(oldAcl);
        this.repoServiceContract.invalidatePublicItemsForAccount(accountId);
    }

    /**
     * Verifies if the user has any account with edit permissions
     * @param accountIds
     * @param userId
     */
    async hasAvailableEditorAccount(accountIds: string[], userId: string): Promise<boolean> {
        const myResourceGroups = await this.findMyResourceGroups(accountIds, ResourceType.DOCUMENT, [PermissionName.EDIT], { includePublic: IncludePublicPolicy.EXCLUDE }, userId);
        if (myResourceGroups.length > 0 && myResourceGroups[0].resources.length > 0) {
            return true;
        }
        return false;
    }

    private async getAccountsForEditorFromEntityMapper(userId): Promise<AccountsWithPermissions[]> {
        const assignees = await this.entityMapper.getAssignees(AssigneeType.USER, userId);
        const accounts: AccountsWithPermissions[] = await this.aclRepository.findAccountsWithPermission(assignees, [
            { resourceType: ResourceType.DOCUMENT, permission: PermissionName.EDIT },
            { resourceType: ResourceType.ACCOUNT, permission: PermissionName.EDIT },
        ]);
        return accounts;
    }

    private async invalidateAssignees(acl: Acl): Promise<void> {
        const processed = new Set();
        const invalidateUserPermissions = async (userId: string) => {
            if (!processed.has(userId)) {
                this.redisPermissionsRepository.invalidatePermissionsForUser(userId);
                processed.add(userId);
            }
        }
        for (const userAssignee of acl.getUserAssignees()) {
            invalidateUserPermissions(userAssignee);
        }
        for (const groupAssignee of acl.getUsergroupAssignees()) {
            const { members } = await this.userServiceClient.getGroupMembers(acl.accountId.value(), groupAssignee, {});
            for (const member of members) {
                invalidateUserPermissions(member.id);
            }
        }
    }

    private async invalidatePermissionsFromAclIfNeeded(acl: Acl): Promise<void> {
        if (this.hasAclAdminOrEditors(acl)) {
            this.invalidateAssignees(acl);
        }
    }

    private hasAclAdminOrEditors(acl: Acl): boolean {
        return acl.rules.some(
            r => r.permissions.findIndex(p => p.name === PermissionName.EDIT) > -1 ||
                r.permissions.findIndex(p => p.name === PermissionName.ADMIN) > -1,
        )
    }

    async getAccountsForEditor(userId) {
        const cachedAccounts = await this.redisPermissionsRepository.getAccountsWithPermissions(userId);
        if (cachedAccounts.length > 0) {
            return cachedAccounts;
        }
        const accounts = await this.getAccountsForEditorFromEntityMapper(userId);
        this.redisPermissionsRepository.setAccountsWithPermissions(userId, accounts);
        return accounts;
    }

    async addDocumentAcl(
        accountId: string,
        documentId: string,
        roleId: string,
        aclRestrictionSet?: IAclRestrictionSet,
        auditLogCallback?: (newAcl: ClientAcl, oldAcl?: ClientAcl) => void
    ): Promise<ClientAcl> {
        const role = await this.roleRepository.getRoleById(roleId);
        let acl = await this.findDocumentAclByRoleAndRestrictions(accountId, documentId, roleId, aclRestrictionSet);
        if (!acl) {
            acl = await this.createNewDocumentAcl(accountId, documentId, role, aclRestrictionSet);
            auditLogCallback(toClientAcl(acl), undefined);
        }
        this.repoServiceContract.invalidatePublicItemsForAccount(accountId);
        return toClientAcl(acl);
    }

    private async createNewDocumentAcl(accountId: string, documentId: string, role: Role, aclRestrictionSet?: IAclRestrictionSet): Promise<Acl> {
        const acl = await this.newDocumentAclBuilder(accountId, documentId, role, aclRestrictionSet);
        return this.aclRepository.createAcl(acl);
    }

    private async findDocumentAclByMaxPermission(accountId: string, documentId: string, permission: PermissionName): Promise<Maybe<Acl>> {
        const documentResource = { type: ResourceType.DOCUMENT, ids: [documentId] };
        const aclsWithPermission = await this.aclRepository.findAclMatches([], [documentResource], [permission], accountId);
        return this.extractAclByMaxPermission(aclsWithPermission, permission);
    }

    private async findDocumentAclByRoleAndRestrictions(accountId: string, documentId: string, roleId: string, aclRestrictionSet?: IAclRestrictionSet): Promise<Acl> {
        const documentResource = { type: ResourceType.DOCUMENT, ids: [documentId] };
        const matchingAcls = await this.aclRepository.findDocumentAclsForRoleAndRestrictions([documentResource], roleId, aclRestrictionSet);
        const [acl, ...ignoredAcls] = matchingAcls;
        if (matchingAcls.length > 1) {
            this.logger.warn(`Multiple acls with same roleId found for document ${documentId}, ignoring ${ignoredAcls.map(acl => acl.id).join()}`, "acl-filtering");
        }
        return acl;
    }

    private extractAclByMaxPermission(acls: Acl[], permission: PermissionName): Maybe<Acl> {
        const matchingAcls = acls.filter(filterAclByMaxPermission(permission));
        if (matchingAcls.length === 0) {
            return Maybe.nothing<Acl>();
        }
        if (matchingAcls.length > 1) {
            this.logger.warn(`Multiple acls with same max permission ${PermissionName[permission]}`, "acl-filtering");
        }
        return Maybe.just(matchingAcls[0]);
    }

    async removeResourceFromAcls(resourceId: string): Promise<void> {
        this.aclRepository.removeResourceFromAcls(resourceId);
    }


    async getAdminGroup(accountId: string) {
        const adminAcl = await this.getAdminAcl(accountId);
        const usergroups = adminAcl.getUsergroupAssignees();
        return usergroups.length > 0 ? usergroups[0] : undefined;
    }

    // Roles

    saveRole(
        name: string,
        isBuiltin: boolean,
        isDefault: boolean,
        permissions: PermissionName[],
        accountId: string,
    ): Promise<Role> {
        const idObject = RoleIdentifier.generate();
        const role = new Role(idObject.value(), name, permissions, isBuiltin, isDefault, accountId, undefined);
        return this.roleRepository.saveRole(role);
    }

    allRolesForAccount(accountId: string): Promise<Role[]> {
        return this.roleRepository.allRolesForAccount(accountId);
    }

    getAccountDefaultRole(accountId: string): Promise<Role> {
        return this.roleRepository.getDefaultRole(accountId);
    }

    async deleteAllForAccount(accountId: string): Promise<void> {
        if (accountId == null) throw new Error("AccountId is null");
        await this.aclRepository.deleteAllForAccount(accountId);
        await this.roleRepository.deleteAllForAccount(accountId);
    }

    async containsPublicAcl(accountId: string, itemIds: string[]): Promise<boolean> {
        const resourceAcls = await this.resourceAcls(
            { type: ResourceType.DOCUMENT, ids: itemIds },
            accountId,
            "public",
        );
        return Object.values(resourceAcls).some(hasPublic);
    }
}

export class AuthorizationServiceFactory {

    private aclRepoFactory: AclRepositoryFactory;
    private roleRepoFactory: RoleRepositoryFactory;
    private accountsPermissionsRedisClient: RedisPermissionsRepository;

    constructor(
        private readonly config: Config,
        aclCollectionConfig: CollectionConfig,
        rolesCollectionConfig: CollectionConfig,
        private readonly entityMapperFactory: EntityMapperFactory,
        private readonly repoService: BinderRepositoryServiceClient,
        private readonly accountService: AccountServiceClient,
        private readonly userService: UserServiceClient,
    ) {
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        this.aclRepoFactory = new AclRepositoryFactory(aclCollectionConfig, topLevelLogger);
        this.roleRepoFactory = new RoleRepositoryFactory(rolesCollectionConfig, topLevelLogger);
        this.accountsPermissionsRedisClient = RedisPermissionsRepository.fromConfig(config);
    }

    async forRequest(request: {logger: Logger }): Promise<AuthorizationService> {
        const aclRepo = this.aclRepoFactory.build(request.logger);
        const roleRepo = this.roleRepoFactory.build(request.logger);
        const mapper = await this.entityMapperFactory.forRequest(request)
        return new AuthorizationService(
            aclRepo,
            roleRepo,
            mapper,
            this.repoService,
            this.accountService,
            request.logger,
            this.accountsPermissionsRedisClient,
            this.userService,
        );
    }

    getRepoFactory(): AclRepositoryFactory {
        return this.aclRepoFactory;
    }

    static fromConfig(config: Config, mapperFactoryOverride?: EntityMapperFactory): Promise<AuthorizationServiceFactory> {
        const loginOption = getMongoLogin("authorization_service");
        const mapperFactory = mapperFactoryOverride ? mapperFactoryOverride : APIEntityMapperFactory.fromConfig(config);
        return Promise.all([
            CollectionConfig.promiseFromConfig(config, "acls", loginOption),
            CollectionConfig.promiseFromConfig(config, "roles", loginOption),
            BackendRepoServiceClient.fromConfig(config, "az-service"),
            BackendAccountServiceClient.fromConfig(config, "az-service"),
            BackendUserServiceClient.fromConfig(config, "az-service"),
        ]).then(([
            aclCollectionConfig,
            roleCollectionConfig,
            repoServiceClient,
            accountServiceClient,
            userServiceClient,
        ]) => {
            return new AuthorizationServiceFactory(
                config,
                aclCollectionConfig,
                roleCollectionConfig,
                mapperFactory,
                repoServiceClient,
                accountServiceClient,
                userServiceClient,
            );
        });
    }
}