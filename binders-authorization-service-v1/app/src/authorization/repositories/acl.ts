import * as mongoose from "mongoose";
import {
    AccountIdentifier,
    AclIdentifier
} from "@binders/binders-service-common/lib/authentication/identity";
import {
    AccountsWithPermissions,
    AclNotFoundException,
    AssigneeGroup,
    AssigneeType,
    IAclFilter,
    IAclRestrictionSet,
    PermissionName,
    ResourceGroup,
    ResourceGroupWithKey,
    ResourcePermission,
    ResourceType,
    allPermissionNames
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Acl, IAccountPermissionQuery, IAcl, IAssignee } from "../models/acl";
import { AclInvalidateEvent, InvalidatorManager } from "@binders/binders-service-common/lib/cache";
import {
    MongoRepository,
    MongoRepositoryFactory,
    Query
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";
import {
    buildResourceGroupKey
} from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import { isProduction } from "@binders/client/lib/util/environment";
import { uniq } from "ramda";

export interface Repository {

    findAclMatches(
        assignees: AssigneeGroup[],
        resources: ResourceGroup[],
        permissions: PermissionName[],
        accountId?: string
    ): Promise<Acl[]>;

    findAcls(filter: IAclFilter): Promise<Acl[]>;

    findDocumentAclsForRoleAndRestrictions(
        resources: ResourceGroup[],
        roleId: string,
        aclRestrictionSet?: IAclRestrictionSet,
    ): Promise<Acl[]>;

    findResourceGroups(
        assignees: AssigneeGroup[],
        resourceTypes: ResourceType[],
        permission: PermissionName,
        accountIds?: string[]
    ): Promise<ResourceGroup[]>;

    /**
     * Return the resource type acls from the given accountId for the userIds and groupIds
     * @param accountId
     * @param userAndGroupIds
     * @param resourceType
     * @returns {Promise<Acl[]>}
     */
    userAcls(accountId: AccountIdentifier, userAndGroupIds: string[], resourceType: ResourceType): Promise<Acl[]>;

    /**
     * Return the acls connected to the current users accountId
     * @param accountId
     * @returns {Promise<Acl[]>}
     */
    accountAcls(accountId: AccountIdentifier): Promise<Array<Acl>>;

    /**
  * returns an acl with the given identifier
  * @param aclIdentifier
  * @returns {Promise<Acl>}
  */
    getAcl(aclIdentifier: AclIdentifier): Promise<Acl>;

    /**
  * Create an ACL
  * @param toCreate
  * @returns {Promise<Acl>}
  */
    createAcl(toCreate: Acl): Promise<Acl>;

    /**
  * Update a current ACL
  * @param toUpdate
  * @param aclIdentifier
  * @returns {Promise<Acl>}
  */
    updateAcl(toUpdate: Acl, aclIdentifier: AclIdentifier): Promise<Acl>;

    duplicateAcl(fromId: string, toId: string, resourceType: ResourceType, accountId: string): Promise<Acl[]>;

    /**
  * Delete an ACL
  * @param aclIdentifier
  * @returns {Promise<void>}
  */
    deleteAcl(aclIdentifier: AclIdentifier): Promise<void>;

    /**
     * Find the account ids matching the query
     */
    findAccountsWithPermission(assignees: AssigneeGroup[], permissionQueries: IAccountPermissionQuery[]): Promise<AccountsWithPermissions[]>;

    /**
     * Remove a given resource id from all acls it's included in
     */
    removeResourceFromAcls(resourceId: string): Promise<void>;

    /**
     * Queries the collection directly
     */
    queryAcls(query: Query): Promise<Acl[]>;

    getAclsForAccountGroup(accountId: string, groupId: string): Promise<Acl[]>;

    deleteAllForAccount(accountId: string): Promise<void>;
}

const resourceTypeEnum = {
    values: [ResourceType.DOCUMENT, ResourceType.ACCOUNT],
    message: "Invalid resource type for path `{PATH}` with value `{VALUE}`"
};


const assigneeTypeEnum = {
    values: [AssigneeType.ACCOUNT, AssigneeType.PUBLIC, AssigneeType.USER, AssigneeType.USERGROUP],
    message: "Invalid assignee type for path `{PATH}` with value `{VALUE}`"
};

const ruleSchema = new mongoose.Schema(
    {
        resourceType: { type: Number, enum: resourceTypeEnum, required: true },
        resourceIds: { type: [String], required: true },
        permissions: { type: [Number], required: true }
    },
    { id: false }
);

const RestrictionSetSchema = new mongoose.Schema({
    languageCodes: { type: [String], required: false },
})

const getAclSchema = (collectionName): mongoose.Schema => {
    const schema = new mongoose.Schema(
        {
            aclId: { type: String, required: true },
            accountId: { type: String }, // a user can belong to multiple accounts
            assignees: [
                {
                    assigneeType: { type: Number, enum: assigneeTypeEnum },
                    assigneeIds: { type: [String] }
                }
            ],
            name: { type: String, required: true },
            description: { type: String },
            rules: [ruleSchema],
            roleId: { type: String },
            restrictionSet: {
                type: RestrictionSetSchema,
                required: false,
            },
            createdOn: { type: Date, default: Date.now },
            updatedOn: { type: Date, default: Date.now }
        },
        { collection: collectionName }
    );
    return addTimestampMiddleware(schema, "updatedOn");
};

const aclDaoToModel = (acl: IAcl): Acl => {
    const aclId = new AclIdentifier(acl.aclId);
    let authorizationRules: ResourcePermission[] = [];
    if (acl.rules) {
        authorizationRules = acl.rules.map(rule => {
            const resource: ResourceGroup = {
                type: rule.resourceType,
                ids: rule.resourceIds
            };
            return {
                resource,
                permissions: rule.permissions.map(name => Object.assign({ name }))
            };
        });
    }

    // user ids
    const accountIdentifier = new AccountIdentifier(acl.accountId);
    const assignees = acl.assignees.map(assignee => {
        return {
            type: assignee.assigneeType,
            ids: assignee.assigneeIds
        };
    });
    let restrictionSet;
    if (acl.restrictionSet && acl.restrictionSet.languageCodes) {
        restrictionSet = { languageCodes: acl.restrictionSet.languageCodes };
    }
    return new Acl(
        aclId,
        acl.name,
        acl.description,
        accountIdentifier,
        assignees,
        authorizationRules,
        acl.roleId,
        restrictionSet,
    );
};

const aclModelToDao = (acl: Acl): IAcl => {
    const rules = acl.rules.map(aclRule => {
        return {
            resourceType: aclRule.resource.type,
            resourceIds: aclRule.resource.ids,
            permissions: aclRule.permissions.map(perm => perm.name)
        };
    });

    const assigneeToDao = (modelAssignee: AssigneeGroup) => {
        return <IAssignee>{
            assigneeType: modelAssignee.type,
            assigneeIds: modelAssignee.ids
        };
    };

    return <IAcl>{
        aclId: acl.id.value(),
        name: acl.name,
        accountId: acl.accountId.value(),
        assignees: acl.assignees.map(assigneeToDao),
        description: acl.description,
        rules,
        restrictionSet: acl.restrictionSet,
        roleId: acl.roleId
    };
};

export class MongoAclRepository extends MongoRepository<IAcl> implements Repository {

    private invalidator = new InvalidatorManager();

    private async invalidateAcls(
        type: "onDelete" | "onCreate" | "onUpdate",
        acls: IAcl[]
    ): Promise<void> {
        const events = acls.map<AclInvalidateEvent>(acl => ({
            name: "acl",
            accountId: acl.accountId,
            aclId: acl.id,
            resourceIds: this.getResourceIdsForAcl(acl)
        }));
        await this.invalidator[type](events);
    }

    private getResourceIdsForAcl(acl: IAcl): string[] {
        const resources = [];
        acl.rules?.forEach(rule => {
            if (rule.resourceIds == null) return;
            resources.push(...rule.resourceIds);
        });
        return resources;
    }

    private buildAssigneeQuery(assignee: AssigneeGroup) {
        if (assignee.type === AssigneeType.PUBLIC) {
            return {
                assignees: mongoose.trusted({
                    $elemMatch: {
                        assigneeType: AssigneeType.PUBLIC
                    }
                })
            };
        }
        return {
            assignees: mongoose.trusted({
                $elemMatch: {
                    assigneeType: assignee.type,
                    assigneeIds: {
                        $in: assignee.ids.map(String)
                    },
                }
            })
        };
    }

    private buildAssigneesQuery(assignees: AssigneeGroup[]) {
        return { $or: assignees.map(this.buildAssigneeQuery) };
    }

    async getAclsForAccountGroup(accountId: string, groupId: string): Promise<Acl[]> {
        const query = {
            accountId,
            assignees: mongoose.trusted({
                $elemMatch: {
                    assigneeIds: String(groupId),
                },
            }),
        };
        const daos = await this.findEntities(query);
        return daos.map(aclDaoToModel);
    }

    findAclMatches(
        assignees: AssigneeGroup[],
        resources: ResourceGroup[],
        permissions: PermissionName[],
        accountId?: string
    ): Promise<Acl[]> {
        const resourceQueryPart = (resource: ResourceGroup) => {
            return {
                rules: mongoose.trusted({
                    $elemMatch: {
                        resourceType: resource.type,
                        resourceIds: {
                            $in: resource.ids.map(String)
                        }
                    }
                })
            };
        };

        const permissionsQueryPart = (permission: PermissionName) => {
            return {
                rules: mongoose.trusted({
                    $elemMatch: {
                        permissions: permission
                    }
                })
            };
        };

        const queryWithoutPermissions =
            assignees.length === 0 ?
                { $or: resources.map(resourceQueryPart) } :
                {
                    $and: [
                        this.buildAssigneesQuery(assignees),
                        { $or: resources.map(resourceQueryPart) },
                    ]
                };

        const queryWithoutAccount =
            permissions.length === 0 ?
                queryWithoutPermissions :
                {
                    $and: [
                        queryWithoutPermissions,
                        { $or: permissions.map(permissionsQueryPart) },
                    ]
                };
        const query = accountId ?
            {
                $and: [{ accountId }, queryWithoutAccount]
            } :
            queryWithoutAccount;
        return this.findEntities(query).then(result => result.map(aclDaoToModel));
    }

    async findAcls(filter: IAclFilter): Promise<Acl[]> {
        const { roleIds, resourceTypes } = filter;
        const andParts = [] as Query[];
        if (roleIds) {
            andParts.push({
                $or: roleIds.map(roleId => ({ roleId }))
            });
        }
        if (resourceTypes) {
            andParts.push({
                $or: resourceTypes.map(resourceType => ({
                    rules: mongoose.trusted({ $elemMatch: { resourceType } })
                }))
            });
        }
        if (andParts.length === 0) {
            return [];
        }
        const daos = await this.findEntities({ $and: andParts });
        return daos.map(aclDaoToModel);
    }

    async findDocumentAclsForRoleAndRestrictions(
        resources: ResourceGroup[],
        roleId: string,
        aclRestrictionSet?: IAclRestrictionSet,
    ): Promise<Acl[]> {
        const resourceQueryPart = (resource: ResourceGroup) => {
            return {
                rules: mongoose.trusted({
                    $elemMatch: {
                        resourceType: resource.type,
                        resourceIds: { $in: resource.ids.map(String) }
                    }
                })
            };
        };

        let restrictionSetQueryPart;

        if (aclRestrictionSet?.languageCodes) {
            restrictionSetQueryPart = {
                "restrictionSet.languageCodes": aclRestrictionSet.languageCodes,
            }
        }

        const query = {
            $and: [
                { $or: resources.map(resourceQueryPart) },
                { roleId },
                ...(restrictionSetQueryPart ? [{ ...restrictionSetQueryPart }] : []),
            ]
        };
        const daos = await this.findEntities(query);
        return daos.map(aclDaoToModel);
    }

    async findResourceGroups(
        assignees: AssigneeGroup[],
        resourceTypes: ResourceType[],
        permission: PermissionName,
        accountIds?: string[]
    ): Promise<ResourceGroupWithKey[]> {
        const resourceQueryPart = (resourceType: ResourceType) => {
            return {
                rules: mongoose.trusted({
                    $elemMatch: {
                        resourceType: resourceType,
                        permissions: permission,
                    }
                })
            };
        };
        const andParts = [this.buildAssigneesQuery(assignees), { $or: resourceTypes.map(resourceQueryPart) }] as Query[];
        if (accountIds && accountIds.length > 0) {
            const orAccountIdsParts = accountIds.map(accountId => ({ accountId: { $eq: String(accountId) } }));
            andParts.push({
                $or: orAccountIdsParts,
            });
        }
        const aclDaos = await this.findEntities({ $and: andParts });
        const acls = aclDaos.map(aclDao => aclDaoToModel(aclDao));
        return this.reduceResourceGroups(acls);
    }

    reduceResourceGroups(acls: Acl[]): ResourceGroupWithKey[] {
        const reduced = {};
        acls.forEach(acl => {
            acl.rules.forEach(rule => {
                const resourceGroupKey = buildResourceGroupKey(rule.resource.type, acl.restrictionSet);
                if (!(resourceGroupKey in reduced)) {
                    reduced[resourceGroupKey] = [];
                }
                reduced[resourceGroupKey] = uniq(reduced[resourceGroupKey].concat(rule.resource.ids));
            });
        });
        const result: ResourceGroupWithKey[] = [];
        for (const resourceGroupKey in reduced) {
            const resourceTypeStr = resourceGroupKey.split("-")[0];
            result.push({ type: parseInt(resourceTypeStr, 10), resourceGroupKey, ids: reduced[resourceGroupKey] });
        }
        return result;
    }

    getAclWithPermissionNames(resourceId: string, permissionName?: PermissionName[]): Promise<Acl | undefined> {
        const query = {
            rules: mongoose.trusted({
                $elemMatch: {
                    resourceIds: String(resourceId),
                    permissions: permissionName,
                },
            }),
        };
        return this.fetchOne(query).then(result => {
            if (result.isJust()) {
                return aclDaoToModel(result.get());
            }
            return undefined;
        });
    }

    getAcl(aclIdentifier: AclIdentifier): Promise<Acl> {
        return this.fetchOne({ aclId: aclIdentifier.value() }).then(storedOption => {
            if (storedOption.isJust()) {
                return aclDaoToModel(storedOption.get());
            }
            throw new AclNotFoundException(aclIdentifier.value());
        });
    }

    accountAcls(accountId: AccountIdentifier): Promise<Array<Acl>> {
        return this.findEntities({ accountId: accountId.value() }).then(daos => daos.map(aclDaoToModel));
    }

    async userAcls(accountId: AccountIdentifier, userAndGroupIds: string[], resourceType: ResourceType): Promise<Acl[]> {
        const query = {
            accountId: accountId.value(),
            assignees: mongoose.trusted({
                $elemMatch: {
                    assigneeIds: {
                        $in: userAndGroupIds.map(String),
                    },
                }
            }),
            rules: mongoose.trusted({
                $elemMatch: {
                    resourceType,
                }
            })
        };
        const daos = await this.findEntities(query);
        return daos.map(aclDaoToModel);
    }

    async createAcl(toCreate: Acl): Promise<Acl> {
        const dao = aclModelToDao(toCreate);
        await this.invalidateAcls("onCreate", [dao]);
        return this.insertEntity(<IAcl>dao).then(async acl => {
            return aclDaoToModel(acl)
        });
    }

    async updateAcl(toUpdate: Acl, aclIdentifier: AclIdentifier): Promise<Acl> {
        const dao = aclModelToDao(toUpdate);
        await this.invalidateAcls("onUpdate", [dao]);
        return this.saveEntity({
            aclId: aclIdentifier.value()
        },
            <IAcl>dao
        ).then(async acl => {
            return aclDaoToModel(acl)
        });
    }

    async duplicateAcl(fromId: string, toId: string, resourceType: ResourceType, accountId: string): Promise<Acl[]> {
        const documentGroup = { type: resourceType, ids: [fromId] };
        const resourceAcls = await this.findAclMatches([], [documentGroup], allPermissionNames, accountId);
        const dupAcls = await Promise.all(resourceAcls.map(async resourceAcl => {
            const { name, description, accountId, assignees, rules, roleId, restrictionSet } = resourceAcl;
            const updatedRules = rules.map(rule => ({
                ...rule,
                resource: {
                    ...rule.resource,
                    ids: rule.resource.ids.map(id => id.replace(fromId, toId)),
                }
            }));
            const dupAcl = new Acl(
                AclIdentifier.generate(),
                name.replace(new RegExp(fromId, "g"), toId),
                description.replace(new RegExp(fromId, "g"), toId),
                accountId,
                assignees,
                updatedRules,
                roleId,
                restrictionSet,
            );
            return this.createAcl(dupAcl);
        }));
        return dupAcls;
    }

    async deleteAcl(aclIdentifier: AclIdentifier): Promise<void> {
        const acl = await this.model.findOneAndDelete(
            { aclId: aclIdentifier.value() }
        ).setOptions({ sanitizeFilter: true });
        await this.invalidateAcls("onDelete", [acl]);
    }

    deleteAllWithResourceType(resourceType: ResourceType): Promise<void> {
        if (isProduction()) {
            throw new Error("No thanks!");
        }
        return this.findEntities({ "rules.resourceType": resourceType }).then(acls => {
            return acls.reduce((reduced, acl) => {
                return reduced.then(() => this.deleteAcl(new AclIdentifier(acl.aclId)));
            }, Promise.resolve<void>(undefined));
        });
    }

    getAccountIdsWithPublicAcls(): mongoose.Query<string[], IAcl> {
        return this.model.distinct("accountId", { assignees: mongoose.trusted({ $elemMatch: { assigneeType: 2 } }) })
            .setOptions({ sanitizeFilter: true });
    }

    async findAccountsWithPermission(assignees: AssigneeGroup[], permissionQueries: IAccountPermissionQuery[]): Promise<AccountsWithPermissions[]> {
        const resourceMongoQueries = permissionQueries.map(apq => {
            return {
                rules: {
                    $elemMatch: {
                        resourceType: apq.resourceType,
                        permissions: apq.permission,
                    }
                }
            };
        });
        const assigneeMongoQueries = assignees.map(a => this.buildAssigneeQuery(a));
        const query = assigneeMongoQueries.map(amq => {
            return {
                $and: [
                    amq,
                    { $or: resourceMongoQueries }
                ]
            };
        });
        const results = await this.model.aggregate([
            { $match: { $or: query } },
            {
                $group: {
                    _id: {
                        accountId: "$accountId",
                        resourceType: "$rules.resourceType",
                        permissions: "$rules.permissions"
                    },
                    count: {
                        $sum: 1
                    },
                }
            }
        ]).exec();
        const accountsWithPermissions: AccountsWithPermissions[] = [];
        results.forEach(result => {
            const { accountId, resourceType: resourceTypes, permissions: permissionsList } = result._id;
            let accountIndex = accountsWithPermissions.findIndex(awp => awp.accountId === accountId);
            if (accountIndex === -1) {
                accountsWithPermissions.push({
                    accountId,
                    permissions: []
                });
                accountIndex = accountsWithPermissions.length - 1;
            }
            resourceTypes.forEach(resourceType => {
                // eslint-disable-next-line prefer-spread
                const permissions = [].concat.apply([], permissionsList)
                    .filter(p => permissionQueries.find(pq =>
                        pq.permission === p && pq.resourceType === resourceType
                    ));
                permissions.forEach(permission => {
                    accountsWithPermissions[accountIndex].permissions.push({
                        resourceType,
                        permission
                    });
                });
            });
        });
        return accountsWithPermissions;
    }

    getAllAcls(): Promise<Acl[]> {
        return this.findEntities({}).then(results => {
            return results.map(el => aclDaoToModel(el));
        });
    }

    async removeResourceFromAcls(resourceId: string): Promise<void> {
        const query = {
            rules: mongoose.trusted({
                $elemMatch: {
                    resourceType: 1,
                    resourceIds: String(resourceId)
                }
            })
        }
        const matchingRules = await this.findEntities(query);
        await this.invalidateAcls("onDelete", matchingRules);
        await this.deleteMany(query);
    }

    async queryAcls(query: Query): Promise<Acl[]> {
        const daos = await this.findEntities(query);
        return daos.map(aclDaoToModel);
    }

    async deleteAllForAccount(accountId: string): Promise<void> {
        await this.deleteMany({ accountId });
    }
}

/**
* Creates the acl repository
*/
export class AclRepositoryFactory extends MongoRepositoryFactory<IAcl> {
    build(logger: Logger): MongoAclRepository {
        return new MongoAclRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getAclSchema(this.collection.name);
        schema.index({ aclId: 1 }, { unique: true });
        schema.index({ accountId: 1 });
        this.model = this.collection.connection.model<IAcl>("AclDAO", schema);
    }
}
