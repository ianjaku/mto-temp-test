import * as mongoose from "mongoose";
import { IUserTag, UserTagsFilter } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { EntityNotFound } from "@binders/client/lib/clients/model";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface IUserTagRepository {
    getAllForUserIds(userIds: string[]): Promise<IUserTag[]>;
    getTag(name: string, value: string, context: string): Promise<IUserTag>;
    getUserTags(userId: string, filter: UserTagsFilter): Promise<IUserTag[]>;
    insert(userTag: IUserTag): Promise<void>;
    insertMulti(userTags: IUserTag[]): Promise<void>;
    upsertMulti(userTags: IUserTag[]): Promise<void>;

    /**
     * For the passed in users, resolves whether they have (or not) a tag assigned to them
     * @param userIds - users to check
     * @param tagName - tag name to check for
     * @return A map of `userId`, `status` pairs where status set based on the tag existence
     */
    getUsersTagStatus(userIds: string[], tagName: string): Promise<Map<string, boolean>>;
}

export class UserTagNotFound extends EntityNotFound {
    constructor(name: string, value: string, context: string) {
        super(`User tag not found: ${name}=${value} in context ${context}`);
        Object.setPrototypeOf(this, UserTagNotFound.prototype); // ES5 >= requirement
    }
}

type IUserTagDocument = IUserTag & mongoose.Document;

function getUserTagSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        type: {
            type: String,
            required: true
        },
        id: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        value: {
            type: String,
            required: true
        },
        context: {
            type: String,
            required: true
        },
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

export class MongoUserTagRepository extends MongoRepository<IUserTagDocument> implements IUserTagRepository {

    async getAllForUserIds(userIds: string[]): Promise<IUserTag[]> {
        const options = {
            batchSize: userIds.length * 5,
            projection: "-_id type id name value context"
        };
        const daos = await this.findEntities(
            {
                id: mongoose.trusted({ $in: userIds.map(String) }),
            },
            options
        );
        return daos;
    }

    async insert(userTag: IUserTagDocument): Promise<void> {
        await this.insertEntity(userTag);
    }

    async insertMulti(userTags: IUserTagDocument[]): Promise<void> {
        await this.insertMany(userTags);
    }

    async upsertMulti(userTags: IUserTagDocument[]): Promise<void> {
        const updated = new Date();
        const bulk = userTags.map(userTag => {
            return {
                updateOne: {
                    filter: { id: userTag.id, name: userTag.name, context: userTag.context },
                    update: { ...userTag, updated },
                    upsert: true
                }
            };
        });
        // Reason for `as any`
        // bulk is of type AnyBulkWriteOperation<IUserTagDocument>[]
        // however, when hinted, typescript compilation fails with
        // RangeError: Map maximum size exceeded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.bulkWrite(bulk as any);
    }

    async getTag(name: string, value: string, context: string): Promise<IUserTag> {
        const maybeDao = await this.fetchOne({ name, value, context });
        if (maybeDao.isJust()) {
            return maybeDao.get();
        }
        throw new UserTagNotFound(name, value, context);
    }

    async getUserTags(userId: string, filter: UserTagsFilter): Promise<IUserTag[]> {
        const tags = await this.findEntities({
            ...filter,
            id: userId
        });
        return tags as IUserTag[];
    }

    async getUsersTagStatus(userIds: string[], tagName: string): Promise<Map<string, boolean>> {
        const results = await this.findEntities({
            name: tagName,
            id: mongoose.trusted({ $in: userIds.map(String) }),
        });

        const userTagStatus = new Map<string, boolean>();
        results.forEach(userTagDoc => userTagStatus.set(userTagDoc.id, true));
        userIds.forEach(userId => {
            if (!userTagStatus.has(userId)) {
                userTagStatus.set(userId, false);
            }
        })
        return userTagStatus;
    }
}

export class MongoUserTagRepositoryFactory extends MongoRepositoryFactory<IUserTagDocument> {

    build(logger: Logger): MongoUserTagRepository {
        return new MongoUserTagRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getUserTagSchema(this.collection.name);
        schema.index({ id: 1, name: 1, context: 1 }, { unique: true });
        this.model = this.collection.connection.model<IUserTagDocument>("UserTagDAO", schema);
    }
}
