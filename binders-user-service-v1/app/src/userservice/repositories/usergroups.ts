import * as mongoose from "mongoose";
import {
    IUserGroupsQuery,
    SearchOptions,
    UsergroupQuery,
    UsergroupsPerUser,
} from "@binders/client/lib/clients/userservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import {
    Usergroup,
    UsergroupDetails,
    UsergroupIdentifier,
    UsergroupSearchResult,
    usergroupModelToClient,
} from "../models/usergroup";
import { EntityNotFound } from "@binders/client/lib/clients/model";
import {
    InvalidatorManager
} from "@binders/binders-service-common/lib/cache/invalidating/invalidators";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";
import { mapSearchOptions } from "./shared";

export interface UsergroupRepository {
    getUsergroup(accountId: string, groupId: UsergroupIdentifier, skipDeleted?: boolean): Promise<UsergroupDetails>;
    getUsergroupByName(accountId: string, name: string);
    saveUsergroup(accountId: string, usergroup: Usergroup): Promise<Usergroup>;
    deleteUsergroup(accountId: string, groupId: UsergroupIdentifier): Promise<boolean>;
    restoreUsergroup(accountId: string, groupId: UsergroupIdentifier): Promise<Usergroup>;
    getUsergroupsById(groupIds: UsergroupIdentifier[]): Promise<UsergroupDetails[]>;
    getUsergroups(
        accountId?: string,
        groupIds?: UsergroupIdentifier[],
        includeDeleted?: boolean
    ): Promise<UsergroupDetails[]>;
    addGroupMemberInAccount(accountId: string, groupId: UsergroupIdentifier, userId: UserIdentifier): Promise<void>;
    addGroupMembersInAccount(accountId: string, groupId: string, userId: string[], replaceExistingMembers?: boolean): Promise<{ removedMembers: string[] }>;
    removeGroupMemberInAccount(accountId: string, groupId: UsergroupIdentifier, userId: UserIdentifier): Promise<void>;
    getGroupsForUser(userId: UserIdentifier, accountId?: string): Promise<Array<Usergroup>>;
    getGroupsForUsers(userIds: Array<string>, accountId?: string): Promise<UsergroupsPerUser>;
    search(query: UsergroupQuery, options: SearchOptions): Promise<UsergroupSearchResult>;
    multiget(accountId: string, userGroupQuery: IUserGroupsQuery): Promise<Array<Usergroup>>;
    updateGroupOwners(accountId: string, groupId: string, userIds: string[]): Promise<void>;
    removeUserFromGroupOwners(accountId: string, groupId: string, userId: string): Promise<void>;
}


export class GroupNotFound extends EntityNotFound {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, GroupNotFound.prototype);  // ES5 >= requirement
    }
}

export interface IUsergroup extends mongoose.Document {
    id: string;
    accountId: string;
    name: string;
    members: string[];
    deleted: boolean;
    isReadonly: boolean;
    isAutoManaged: boolean;
    ownerUserIds?: string[];
}

function getGroupSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema({
        id: {
            type: String,
            required: true,
        },
        accountId: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true
        },
        members: {
            type: [String]
        },
        deleted: Boolean,
        isReadonly: Boolean,
        isAutoManaged: Boolean,
        ownerUserIds: [String],
        created: {
            type: Date,
            default: Date.now
        },
        updated: {
            type: Date,
            default: Date.now
        }
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

function modelToDao(accountId: string, model: Usergroup): IUsergroup {
    return <IUsergroup>{
        id: model.id.value(),
        accountId,
        name: model.name,
        members: [],
        isReadonly: model.isReadonly,
        isAutoManaged: model.isAutoManaged,
        ownerUserIds: model.ownerUserIds,
    };
}

function daoToModel(dao: IUsergroup): Usergroup {
    const uid = new UsergroupIdentifier(dao.id);
    return new Usergroup(
        uid,
        dao.name,
        dao.isReadonly,
        dao.isAutoManaged,
        dao.accountId,
        dao.ownerUserIds
    );
}

function daoToModelDetails(dao: IUsergroup): UsergroupDetails {
    return {
        group: daoToModel(dao),
        memberCount: dao.members.length,
        members: dao.members.map(uid => new UserIdentifier(uid))
    };
}

export class MongoUsergroupRepositoryFactory extends MongoRepositoryFactory<IUsergroup> {
    protected updateModel(): void {
        const schema = getGroupSchema(this.collection.name);
        schema.index({ id: 1 }, { unique: true });
        schema.index({ accountId: 1 });
        this.model = this.collection.connection.model<IUsergroup>("UsergroupDAO", schema);
    }

    build(logger: Logger): MongoUsergroupRepository {
        return new MongoUsergroupRepository(this.model, this.collection, logger);
    }
}


export class MongoUsergroupRepository extends MongoRepository<IUsergroup> implements UsergroupRepository {
    private invalidator = new InvalidatorManager();

    getUsergroup(accountId: string, groupId: UsergroupIdentifier, skipDeleted?: boolean): Promise<UsergroupDetails> {
        return this.fetchOne({
            accountId,
            id: groupId.value(),
            deleted: mongoose.trusted({ $ne: !!skipDeleted }),
        }).then(groupOption => {
            if (groupOption.isJust()) {
                return daoToModelDetails(groupOption.get());
            }
            throw new Error(`Usergroup with id ${groupId.value()} does not exist`);
        });
    }

    async getGroupsForUsers(userIds: string[], accountId?: string): Promise<UsergroupsPerUser> {
        const daos = await this.findEntities({
            deleted: mongoose.trusted({ $ne: true }),
            members: mongoose.trusted({ $in: userIds.map(String) }),
            ...(accountId ? { accountId } : {})
        });
        return userIds.reduce((acc, userId) => {
            if (!acc[userId]) {
                acc[userId] = [];
            }
            acc[userId].push(
                ...daos
                    .filter(dao => dao.members.includes(userId))
                    .map(g => daoToModel(g))
                    .map(g => usergroupModelToClient(g))
            );
            return acc;
        }, {} as UsergroupsPerUser);
    }

    async getUsergroupByName(accountId: string, name: string): Promise<Usergroup> {
        const dao = await this.fetchOne({ accountId, name, deleted: mongoose.trusted({ $ne: true }) });
        if (dao.isJust()) {
            return daoToModel(dao.get());
        }
        throw new GroupNotFound(`Usergroup with name ${name} does not exist`);
    }

    getGroupsForUser(userId: UserIdentifier, accountId?: string): Promise<Array<Usergroup>> {
        return this.findEntities({
            deleted: mongoose.trusted({ $ne: true }),
            members: userId.value(),
            ...(accountId ? { accountId } : {})
        }).then(daos => {
            return daos.map(daoToModel)
        });
    }

    async search(query: UsergroupQuery, searchOptions: SearchOptions): Promise<UsergroupSearchResult> {
        if (!Object.keys(query).length) {
            throw new Error("No search query provided");
        }
        const mongoQuery = {
            deleted: mongoose.trusted({ $ne: true }),
        };

        if (query.accountId) {
            mongoQuery["accountId"] = query.accountId;
        }

        if (query.nameRegex) {
            mongoQuery["name"] = mongoose.trusted({ $regex: String(query.nameRegex), $options: "i" });
        }
        if (query.ownerId) {
            mongoQuery["ownerUserIds"] = query.ownerId;
        }
        const mongoOptions = mapSearchOptions(searchOptions);
        const [hitCount, usersgroups] = await Promise.all([
            this.model.countDocuments(mongoQuery).setOptions({ sanitizeFilter: true }).exec(),
            this.findEntities(mongoQuery, mongoOptions)
        ]);
        return {
            hitCount,
            hits: usersgroups.map(daoToModel)
        };
    }

    async multiget(accountId: string, userGroupQuery: IUserGroupsQuery): Promise<Array<Usergroup>> {
        const { names } = userGroupQuery;
        if (!names || !names.length) {
            return [];
        }
        const mongoQuery = {
            accountId,
            name: mongoose.trusted({ $in: names.map(String) }),
            deleted: mongoose.trusted({ $ne: true }),
        };
        const usersgroups = await this.findEntities(mongoQuery, {});
        return usersgroups.map(daoToModel);
    }

    async saveUsergroup(accountId: string, usergroup: Usergroup): Promise<Usergroup> {
        const currentGroups = await this.findEntities({ accountId, deleted: mongoose.trusted({ $ne: true }) });
        const gidValue = usergroup.id.value();
        const { exists, nameInUse } = currentGroups.reduce((reduced, group) => {
            if (group.name === usergroup.name && group.id !== gidValue) {
                reduced.nameInUse = true;
            }
            if (group.id === gidValue) {
                reduced.exists = true;
            }
            return reduced;
        }, { exists: false, nameInUse: false });
        if (nameInUse) {
            throw new Error(`Groupname ${usergroup.name} already in use`);
        }
        if (exists) {
            await this.update({
                accountId,
                id: usergroup.id.value()
            }, {
                $set: {
                    name: usergroup.name,
                    isReadonly: usergroup.isReadonly
                }
            });
            return usergroup;
        }
        else {
            const dao = modelToDao(accountId, usergroup);
            const insertedDao = await this.insertEntity(dao);
            return daoToModel(insertedDao);
        }
    }

    async deleteUsergroup(accountId: string, groupId: UsergroupIdentifier): Promise<boolean> {
        const query = { accountId, id: groupId.value() };
        const maybeGroup = await this.fetchOne(query);
        if (maybeGroup.isJust()) {
            const group = maybeGroup.get();
            await this.invalidator.onDelete([{
                name: "usergroup",
                groupId: group.id,
                userIds: group.members
            }]);
            await this.update(query, { deleted: true });
            return true;
        }
        return false;
    }

    restoreUsergroup(accountId: string, groupId: UsergroupIdentifier): Promise<Usergroup> {
        return this.getUsergroup(accountId, groupId, false)
            .then(currentGroup => {
                return this.fetchOne({ accountId, name: currentGroup.group.name, deleted: mongoose.trusted({ $ne: true }) })
                    .then(async possibleConflict => {
                        if (possibleConflict.isJust()) {
                            throw new Error(`Groupname ${currentGroup.group.name} already in use`);
                        }
                        else {
                            await this.invalidator.onCreate([{
                                name: "usergroup",
                                groupId: groupId.value(),
                                userIds: currentGroup.members.map(m => m.value())
                            }]);
                            return this.update({ accountId, id: groupId.value() }, { deleted: false })
                                .then(async () => {
                                    return currentGroup.group
                                });
                        }
                    });
            });
    }

    async getUsergroupsById(groupIds: UsergroupIdentifier[]): Promise<UsergroupDetails[]> {
        const daos = await this.findEntities({
            id: mongoose.trusted({ $in: groupIds.map(gid => gid.value()) }),
            deleted: mongoose.trusted({ $ne: true }),
        });
        return daos.map(daoToModelDetails)
    }


    async getUsergroups(
        accountId: string,
        groupIds?: UsergroupIdentifier[],
        includeDeleted = false
    ): Promise<UsergroupDetails[]> {
        const results = await this.findEntities({
            accountId,
            ...((groupIds && groupIds.length > 0) ? { id: mongoose.trusted({ $in: groupIds.map(gid => gid.value()) }) } : {}),
            ...(includeDeleted ? {} : { deleted: mongoose.trusted({ $ne: true }) })
        });
        return results.map(daoToModelDetails);
    }

    addGroupMemberInAccount(accountId: string, groupId: UsergroupIdentifier, userId: UserIdentifier): Promise<void> {
        return this.getUsergroup(accountId, groupId)
            .then<void>(async currentGroup => {
                const uidValue = userId.value();
                if (currentGroup.members.find(uid => uid.value() === uidValue) !== undefined) {
                    return undefined;
                }
                await this.invalidator.onCreate([{
                    name: "usergroup",
                    groupId: groupId.value(),
                    userIds: [userId.value()]
                }]);
                await this.update(
                    { accountId, id: groupId.value() },
                    { $push: { members: userId.value() } }
                );
            });
    }

    async addGroupMembersInAccount(
        accountId: string,
        groupId: string,
        userIds: string[],
        replaceExistingMembers = false
    ): Promise<{ removedMembers: string[] }> {
        const currentGroup = await this.getUsergroup(accountId, new UsergroupIdentifier(groupId));
        const currentGroupMembers = new Set(currentGroup.members.map(m => m.value()));
        const newUidValues = userIds.filter(
            uidValue => !currentGroupMembers.has(uidValue)
        );
        if (newUidValues.length === 0 && !replaceExistingMembers) {
            return { removedMembers: [] };
        }
        const addAction = replaceExistingMembers ?
            { members: userIds } :
            { $push: { members: { $each: userIds } } };

        await this.invalidator.onCreate(
            userIds.map(userId => ({
                name: "usergroup",
                groupId: groupId,
                userIds: [userId]
            }))
        );
        await this.update({ accountId, id: groupId }, addAction);
        const removedMembers = replaceExistingMembers ?
            currentGroup.members
                .map(memberIdentifier => memberIdentifier.value())
                .filter(memberId => !userIds.includes(memberId)) :
            [];
        return { removedMembers };
    }

    removeGroupMemberInAccount(accountId: string, groupId: UsergroupIdentifier, userId: UserIdentifier): Promise<void> {
        return this.getUsergroup(accountId, groupId)
            .then<void>(async currentGroup => {
                const uidValue = userId.value();
                if (currentGroup.members.find(uid => uid.value() === uidValue) === undefined) {
                    return undefined;
                }
                await this.invalidator.onDelete([{
                    name: "usergroup",
                    groupId: groupId.value(),
                    userIds: [userId.value()]
                }]);
                await this.update(
                    { accountId, id: groupId.value() },
                    { $pull: { members: userId.value() } }
                );
            });
    }

    async updateGroupOwners(
        accountId: string,
        groupId: string,
        userIds: string[],
    ): Promise<void> {
        await this.update(
            { accountId, id: groupId },
            { $set: { ownerUserIds: userIds } }
        );
    }

    async removeUserFromGroupOwners(accountId: string, groupId: string, userId: string): Promise<void> {
        await this.updateOne({ accountId, id: groupId }, { $pull: { ownerUserIds: userId } });
    }
}
