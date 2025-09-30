import * as mongoose from "mongoose";
import {
    GlobalUserCreations,
    UserCreationMethod,
    UserQuery,
    SearchOptions as UserSearchOptions,
    UserType
} from "@binders/client/lib/clients/userservice/v1/contract";
import {
    Login,
    UserIdentifier
} from "@binders/binders-service-common/lib/authentication/identity";
import { LoginNotAvailable, User, UserSearchResult } from "../models/user";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { InvalidatorManager } from "@binders/binders-service-common/lib/cache";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { UserNotFound } from "@binders/client/lib/clients/userservice/v1/errors";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";
import { buildMonthKey } from "@binders/client/lib/clients/model";
import escapeRegExp from "lodash.escaperegexp";
import { mapSearchOptions } from "./shared";

export interface UserRepository {
    getUserByLogin(login: string): Promise<User>;
    getUsersByLogins(logins: string[]): Promise<User[]>;

    /**
     * WARNING: Only used in the IT framework
     */
    deleteUser(userId: UserIdentifier): Promise<UserIdentifier>;
    getUser(userId: UserIdentifier): Promise<User>;

    /**
     * @param userIds - ids of the users to fetch
     * @param includeDeleted - deleted users are only used by the IT framework
     */
    getUsers(userIds: string[], includeDeleted?: boolean): Promise<User[]>;
    isLoginAvailable(login: Login): Promise<boolean>;
    listUsers(): Promise<User[]>;
    restoreUser(userId: UserIdentifier): Promise<UserIdentifier>;
    saveUser(user: User): Promise<User>;
    insertUsers(users: User[]): Promise<User[]>;
    findUserDetailsForIds(userIds: Array<UserIdentifier>, skipDeleted?: boolean): Promise<Array<User>>;
    searchUsers(query: UserQuery, options: UserSearchOptions): Promise<UserSearchResult>;
    search(validIds: string[], query: string, options: UserSearchOptions): Promise<UserSearchResult>;
    updateLastOnline(userId: UserIdentifier): Promise<void>;
    updateUsers(userIds: string[], update: Partial<User>): Promise<void>;
    getUsersCreatedPerMonth(): Promise<GlobalUserCreations>;
}

export interface IUser extends mongoose.Document {
    userId: string;
    login: string;
    displayName: string;
    firstName: string;
    lastName: string;
    invitationLinkSentDate: Date;
    created: Date;
    updated: Date;
    lastOnline: Date;
    bounced: boolean;
    type: UserType;
    licenseCount: number;
    isPasswordless?: boolean;
    creationMethod?: UserCreationMethod;
}

function userDaoToModel(user: IUser): User {
    return new User(
        new UserIdentifier(user.userId),
        new Login(user.login),
        user.displayName,
        user.firstName,
        user.lastName,
        user.created,
        user.updated,
        user.lastOnline,
        user.bounced,
        user.type,
        user.licenseCount,
        user.isPasswordless,
        user.creationMethod,
    );
}

function userModelToDao(user: User): IUser {
    return <IUser>{
        userId: user.id.value(),
        login: user.login.value().toLowerCase(),
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        created: user.created,
        updated: user.updated,
        lastOnline: user.lastOnline,
        bounced: user.bounced,
        type: user.type,
        licenseCount: user.licenseCount,
        isPasswordless: user.isPasswordless,
        creationMethod: user.creationMethod,
    };
}

function getUserSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema(
        {
            userId: {
                type: String,
                unique: true,
                required: true
            },
            login: {
                type: String,
                unique: true,
                required: true
            },
            displayName: {
                type: String,
                required: true
            },
            firstName: {
                type: String
            },
            lastName: {
                type: String
            },
            deleted: Boolean,
            invitationLinkSentDate: {
                type: Date,
                required: false
            },
            created: {
                type: Date,
                default: Date.now
            },
            updated: {
                type: Date,
                default: Date.now
            },
            lastOnline: {
                type: Date,
                required: false,
                default: undefined,
            },
            bounced: {
                type: Boolean,
                required: false,
                default: false,
            },
            type: {
                type: String,
            },
            licenseCount: {
                type: Number,
            },
            isPasswordless: {
                type: Boolean,
            },
            creationMethod: {
                type: String,
                required: false,
            }
        },
        { collection: collectionName }
    );
    return addTimestampMiddleware(schema, "updated");
}

export class MongoUserRepositoryFactory extends MongoRepositoryFactory<IUser> {
    protected updateModel(): void {
        const schema = getUserSchema(this.collection.name);
        this.model = this.collection.connection.model<IUser>("UserDAO", schema);
    }

    build(logger: Logger): MongoUserRepository {
        return new MongoUserRepository(this.model, this.collection, logger);
    }
}

export class MongoUserRepository extends MongoRepository<IUser> implements UserRepository {

    private invalidator = new InvalidatorManager();

    async search(validIds: string[], query: string, options: UserSearchOptions): Promise<UserSearchResult> {
        const escapedQuery = escapeRegExp(query);
        const mongoQuery = {
            userId: mongoose.trusted({ $in: validIds.map(String) }),
            $or: [
                { displayName: mongoose.trusted({ $regex: escapedQuery, $options: "i" }) },
                { login: mongoose.trusted({ $regex: escapedQuery, $options: "i" }) },
            ]
        };
        const mongoOptions = mapSearchOptions(options);
        const [hitCount, users] = await Promise.all([
            this.model.countDocuments(mongoQuery)
                .setOptions({ sanitizeFilter: true })
                .exec(),
            this.findEntities(mongoQuery, mongoOptions)
        ]);
        return {
            hitCount,
            hits: users.map(userDaoToModel)
        };
    }

    searchUsers(query: UserQuery, options: UserSearchOptions): Promise<UserSearchResult> {
        const mongoQueryParts = [];
        if (query.login) {
            mongoQueryParts.push(
                {
                    login: query.ignoreCase ?
                        mongoose.trusted({
                            $regex: String(query.login),
                            $options: "i"
                        }) :
                        mongoose.trusted({ $regex: String(query.login) })
                }
            );
        }
        if (query.displayName) {
            mongoQueryParts.push(
                {
                    displayName: query.ignoreCase ?
                        mongoose.trusted({
                            $regex: String(query.displayName),
                            $options: "i"
                        }) :
                        mongoose.trusted({ $regex: String(query.displayName) })
                }
            );
        }
        if (query.name) {
            mongoQueryParts.push(
                {
                    displayName: query.ignoreCase ?
                        mongoose.trusted({
                            $regex: String(query.name),
                            $options: "i"
                        }) :
                        mongoose.trusted({ $regex: String(query.name) })
                }
            );
        }
        if (query.createdAfter && query.createdBefore) {
            mongoQueryParts.push({
                created: mongoose.trusted({
                    $gte: new Date(query.createdAfter),
                    $lt: new Date(query.createdBefore)
                })
            });
        } else {
            if (query.createdAfter) {
                mongoQueryParts.push({
                    created: mongoose.trusted({
                        $gte: new Date(query.createdAfter)
                    })
                });
            }
            if (query.createdBefore) {
                mongoQueryParts.push({
                    created: mongoose.trusted({
                        $lt: new Date(query.createdAfter)
                    })
                });
            }
        }
        const mongoQuery = query.combineWithOr ?
            { $or: mongoQueryParts } :
            { $and: mongoQueryParts };
        const mongoOptions = mapSearchOptions(options);
        return Promise.all([
            this.model.countDocuments(mongoQuery)
                .setOptions({ sanitizeFilter: true })
                .exec(),
            this.findEntities(mongoQuery, mongoOptions)
        ]).then(([hitCount, users]) => {
            const result = {
                hitCount,
                hits: users.map(userDaoToModel)
            };
            return result;
        });
    }

    deleteUser(userId: UserIdentifier): Promise<UserIdentifier> {
        return this.updateDeleteFlag(userId, true);
    }

    async getUser(userId: UserIdentifier): Promise<User> {
        const fetchedUserOption = await this.fetchOne({
            userId: userId.value(),
            deleted: mongoose.trusted({ $ne: true })
        });
        if (fetchedUserOption.isJust()) {
            return userDaoToModel(fetchedUserOption.get());
        } else {
            throw new UserNotFound(userId.value());
        }
    }

    async updateLastOnline(userId: UserIdentifier): Promise<void> {
        const lastOnline = new Date();
        await this.update({ userId: userId.value() }, { lastOnline });
    }

    async updateUsers(userIds: string[], update: Partial<User>): Promise<void> {
        this.update({
            userId: mongoose.trusted({ $in: userIds.map(String) }),
        }, update)
    }

    async getUserByLogin(login: string): Promise<User> {
        const query = {
            login: login.toLowerCase(),
            deleted: mongoose.trusted({ $ne: true })
        }
        const fetchedUserOption = await this.fetchOne(query);
        if (fetchedUserOption.isJust()) {
            return userDaoToModel(fetchedUserOption.get());
        } else {
            this.logger.info(`Error on getUserByLogin result ${JSON.stringify(fetchedUserOption)} login ${login} `, "get-user-by-login")
            this.logger.info(`Error query ${JSON.stringify(query)} `, "get-user-by-login")
            throw new UserNotFound(login);
        }
    }

    async getUsersByLogins(logins: string[]): Promise<User[]> {
        const userDaos = await this.findEntities({ login: mongoose.trusted({ $in: logins.map(String) }) });
        return userDaos.map(userDaoToModel);
    }

    isLoginAvailable(login: Login): Promise<boolean> {
        return this.fetchOne({ login: login.value().toLowerCase() }).then(result => result.isNothing());
    }

    listUsers(): Promise<User[]> {
        return this.findEntities({ deleted: mongoose.trusted({ $ne: true }) }).then(daos => daos.map(userDaoToModel));
    }

    getUsers(userIds: string[], includeDeleted = false): Promise<User[]> {
        return this.findEntities(
            {
                userId: mongoose.trusted({ $in: userIds.map(String) }),
                ...(includeDeleted ? {} : { deleted: mongoose.trusted({ $ne: true }) })
            }
        ).then(daos => daos.map(userDaoToModel));
    }

    restoreUser(userId: UserIdentifier): Promise<UserIdentifier> {
        return this.updateDeleteFlag(userId, false);
    }

    saveUser(user: User): Promise<User> {
        const dao = userModelToDao(user);
        return this.saveEntity({ userId: dao.userId }, dao).then(userDaoToModel).catch(error => {
            if (error.code && error.code === 11000) {
                throw new LoginNotAvailable(user.login.value().toLowerCase());
            }
            throw error;
        });
    }

    insertUsers(users: User[]): Promise<User[]> {
        return this.insertMany(users.map(userModelToDao)).then(storedUsers => storedUsers.map(userDaoToModel));
    }

    findUserDetailsForIds(userIds: Array<UserIdentifier>, skipDeleted?: boolean): Promise<Array<User>> {
        const query = {
            userId: mongoose.trusted({ $in: userIds.map(id => id.value()) }),
            ...(skipDeleted ? { deleted: mongoose.trusted({ $ne: true }) } : {}),
        };
        const options = {
            batchSize: userIds.length + 1
        };
        return this.findEntities(query, options).then(daos => daos.map(userDaoToModel));
    }

    async getUsersCreatedPerMonth(): Promise<GlobalUserCreations> {
        const creations = {};
        const results = await this.model.aggregate([
            {
                $group: {
                    _id: {
                        year: {
                            $year: "$created"
                        },
                        month: {
                            $month: "$created"
                        }
                    },
                    count: {
                        $sum: 1
                    },
                }
            }
        ]);
        for (const result of results) {
            const { year, month } = result._id;
            const monthKey = buildMonthKey(year, month);
            creations[monthKey] = result.count;
        }
        return creations;
    }

    private async updateDeleteFlag(userId: UserIdentifier, deleteFlag: boolean) {
        await this.invalidator.onDelete([{
            name: "user",
            userId: userId.value()
        }]);
        return this.update(
            { userId: userId.value() },
            { deleted: deleteFlag }
        ).then(() => userId);
    }
}
