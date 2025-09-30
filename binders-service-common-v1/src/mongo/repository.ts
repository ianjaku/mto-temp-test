import * as mongoose from "mongoose";
import { IndexDiff, diffIndexes, fromMongoDefinition, fromSchemaDefinition } from "./indices/model";
import { Collection } from "./collection";
import { CollectionConfig } from "./config";
import { Logger } from "../util/logging";
import { Maybe } from "@binders/client/lib/monad";
import { filterPrimaryKeyIndex } from "./indices/helpers";
import { registerFactory } from "./factoryRegistry";

export interface UpdateResult {
    matchCount: number;
    updateCount: number;
}

export type Query<T = unknown> = mongoose.FilterQuery<T>;
export type Update<T = unknown> = mongoose.UpdateWithAggregationPipeline | mongoose.UpdateQuery<T>;
export type QueryOptions = mongoose.QueryOptions;
export type UpdateOptions = mongoose.MongooseUpdateQueryOptions;
export type InsertOptions = mongoose.InsertManyOptions;
type QueryCursor<T = unknown> = mongoose.Cursor<T, mongoose.QueryOptions<mongoose.HydratedDocument<T, unknown, unknown>>>

export interface BulkWriteResult {
    insertedCount: number;
    matchedCount: number;
    modifiedCount: number;
    upsertedCount: number;
}

export interface BatchProcessOptions {
    batchSize: number;
    searchOptions?: SearchOptions;
}

const DEFAULT_BATCH_PROCESS_OPTIONS: BatchProcessOptions = {
    batchSize: 250
};

export interface SearchOptions {
    orderByField?: string;
    sortOrder?: "ascending" | "descending";
    limit?: number;
    batchSize?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projection?: any;
    select?: string;
    distinct?: string;
}

export abstract class MongoRepositoryFactory<T extends mongoose.Document> {

    readonly collection: Collection;
    protected model: mongoose.Model<T>;

    constructor(collectionConfig: CollectionConfig, protected logger: Logger) {
        this.collection = Collection.build(collectionConfig, logger);
        this.updateModel();
        registerFactory(this);
    }

    getConnection(): mongoose.Connection {
        return this.collection.connection;
    }

    async createCollection(): Promise<void> {
        await this.model.createCollection();
    }

    protected abstract updateModel(): void;
    abstract build(logger: Logger): MongoRepository<T>;

    async syncIndexes(): Promise<void> {
        this.logger.info(`Syncing indices for ${this.collection.name}`, "mongo-indices");
        await this.model.syncIndexes();
    }

    async dropIndex(name: string): Promise<void> {
        this.logger.info(`Dropping index ${name} from ${this.collection.name}`, "mongo-indices");
        await this.model.collection.dropIndex(name);
    }

    hasConnected(): boolean {
        return this.collection.hasConnected;
    }


    async getCollectionNames(): Promise<string[]> {
        const collections = await this.collection.connection.db.listCollections().toArray();
        return collections.map(c => c.name);
    }

    async diffIndexes(): Promise<IndexDiff> {
        if (!this.hasConnected()) {
            return {
                status: "error",
                details: new Error("Not connected")
            }
        }
        const collectionsInDb = await this.getCollectionNames();
        if (!collectionsInDb.includes(this.collection.name)) {
            return { status: "collection_missing" };
        }
        try {
            const mongoIndexes = await this.model.listIndexes();
            const schemaIndexes = await this.model.schema.indexes();
            const diff = diffIndexes(
                mongoIndexes
                    .map(fromMongoDefinition)
                    .filter(filterPrimaryKeyIndex),
                schemaIndexes.map(fromSchemaDefinition)
            );
            if (diff.toCreate.length + diff.toDrop.length > 0) {
                this.logger.debug(
                    "Diff of mongo index",
                    "mongo-index",
                    {
                        mongoIndexes,
                        schemaIndexes,
                        diff
                    }
                );
            }
            return {
                details: diff,
                status: "ok"
            }
        } catch (err) {
            return {
                status: "error",
                details: err
            }
        }
    }

    async drop(force = false): Promise<void> {
        if (process.env.NODE_ENV !== "production" || force) {
            if (!await this.model.collection.drop()) {
                throw new Error(`Failed to drop collection ${this.model.collection.name}`);
            }
        }
        throw new Error("Cowardly refusing to drop the collection.");
    }
}

export abstract class MongoRepository<T extends mongoose.Document> {

    constructor(
        protected model: mongoose.Model<T>,
        protected readonly collection: Collection,
        protected readonly logger: Logger
    ) {
    }

    protected async batchProcess(
        query: Query,
        doWork: (batch: T[], i: number) => Promise<void>,
        batchOptions: BatchProcessOptions = DEFAULT_BATCH_PROCESS_OPTIONS
    ): Promise<void> {
        let mongoQuery = this.model
            .find(query)
            .setOptions({ sanitizeFilter: true });
        const { batchSize, searchOptions } = batchOptions;
        if (searchOptions) {
            if (searchOptions.orderByField) {
                const sortValue = searchOptions.sortOrder === "descending" ? -1 : 1;
                mongoQuery = mongoQuery.sort({ [searchOptions.orderByField]: sortValue });
            }
            if (searchOptions.limit) {
                mongoQuery = mongoQuery.limit(searchOptions.limit);
            }
        }
        const cursor = mongoQuery.cursor();
        const collectNextBatch = this.collectNextBatch;

        const step = async function(i: number) {
            const nextBatch = await collectNextBatch(cursor, batchSize);
            await doWork(nextBatch, i);
            if (nextBatch.length < batchSize) {
                return undefined;
            }
            return step(i + 1);
        };
        return step(0);
    }

    protected collectNextBatch(cursor: QueryCursor<T>, batchSize: number): Promise<T[]> {
        const next = async (promisedElement, batchSoFar) => {
            const nextElement = await promisedElement;
            if (nextElement === null) {
                return batchSoFar;
            }
            const newBatch = batchSoFar.concat([nextElement]);
            if (newBatch.length === batchSize) {
                return newBatch;
            }
            return next(cursor.next(), newBatch);
        };
        return next(cursor.next(), []);
    }

    protected fetchOne(query: Query): Promise<Maybe<T>> {
        return this.model
            .findOne(query)
            .setOptions({ sanitizeFilter: true })
            .then((retrieved) => {
                if (retrieved === null) {
                    return Maybe.nothing<T>();
                }
                else {
                    return Maybe.just<T>(retrieved);
                }
            });
    }

    protected async findOne(query: Query): Promise<T | null> {
        return this.model
            .findOne(query)
            .setOptions({ sanitizeFilter: true })
            .exec();
    }

    protected findEntities(query: Query, options?: SearchOptions, sanitizeFilter = true): Promise<T[]> {
        let mongoQuery: Query<T> = this.model
            .find(query, options?.projection)
            .setOptions({ sanitizeFilter });
        if (options) {
            if (options.batchSize) {
                mongoQuery = mongoQuery.batchSize(options.batchSize);
            }
            if (options.orderByField) {
                const sortValue = options.sortOrder === "descending" ? -1 : 1;
                mongoQuery = mongoQuery.sort({ [options.orderByField]: sortValue });
            }
            if (options.limit) {
                mongoQuery = mongoQuery.limit(options.limit);
            }
            if (options.select) {
                mongoQuery = mongoQuery.select(options.select);
            }
            if (options.distinct) {
                mongoQuery = mongoQuery.distinct(options.distinct);
            }
        }
        return mongoQuery.exec();
    }

    protected forEachMatchingObject(query: Query, doWork: (item: T) => Promise<void>, maxTimeMS?: number): Promise<void> {
        const queryObj = maxTimeMS ?
            this.model.find(query).setOptions({ sanitizeFilter: true }).maxTimeMS(maxTimeMS) :
            this.model.find(query).setOptions({ sanitizeFilter: true })
        const cursor = queryObj.cursor({ noCursorTimeout: true });
        const step: (e: Promise<T>) => Promise<void> = (promisedElement) => {
            return promisedElement.then(element => {
                if (element) {
                    return doWork(element)
                        .then(() => step(cursor.next()));
                }
                return undefined;
            });
        };
        return step(cursor.next());
    }

    protected insertEntity(dao: T): Promise<T> {
        return this.model.create(dao);
    }

    protected insertMany(daos: T[], options?: InsertOptions): Promise<T[]> {
        return this.model.insertMany(daos, options) as unknown as Promise<T[]>;
    }

    protected async saveEntity(query: Query, dao: Update<T>): Promise<T> {
        return this.upsert(query, dao, true);
    }

    protected async upsert(query: Query, dao: Update<T>, setDefaultsOnInsert = false): Promise<T> {
        return this.model
            .findOneAndUpdate(query, dao, { upsert: true, new: true, setDefaultsOnInsert })
            .setOptions({ sanitizeFilter: true });
    }

    /*
        Note: mongoose's bulkWrite implementation does not trigger the timestamp middleware,
        (https://mongoosejs.com/docs/api/model.html#model_Model.bulkWrite)
        so if you need to update any timestamps (eg an "updated" field), you can do so explicitly in the query
    */
    protected async bulkWrite(query: mongoose.AnyBulkWriteOperation[]): Promise<BulkWriteResult> {
        const result = await this.model.bulkWrite(query)
        const { insertedCount, matchedCount, modifiedCount, upsertedCount } = result
        return {
            insertedCount,
            matchedCount,
            modifiedCount,
            upsertedCount
        };
    }

    protected async update(query: Query, update: Update, options?: UpdateOptions): Promise<UpdateResult> {
        const result = await this.model
            .updateMany(query, update, options || {})
            .setOptions({ sanitizeFilter: true })
        return {
            matchCount: result.matchedCount,
            updateCount: result.modifiedCount
        };

    }

    protected updateOne(query: Query, update: Update, options?: UpdateOptions): Promise<UpdateResult> {
        return this.model
            .updateOne(query, update, options || {})
            .setOptions({ sanitizeFilter: true })
            .then(result => {
                return {
                    matchCount: result.matchedCount,
                    updateCount: result.modifiedCount
                };
            });
    }

    protected findOneAndUpdate(
        query: Query,
        update: Update,
        options?: QueryOptions
    ): Promise<T | null> {
        return this.model.findOneAndUpdate(query, update, options)
            .setOptions({ sanitizeFilter: true });
    }

    protected updateMany(query: Query, update: Update, options?: UpdateOptions): Promise<UpdateResult> {
        return this.model
            .updateMany(query, update, options || {})
            .setOptions({ sanitizeFilter: true })
            .then(result => {
                return {
                    matchCount: result.matchedCount,
                    updateCount: result.modifiedCount
                };
            });
    }

    protected deleteOne(query: Query): Promise<number> {
        return this.model.deleteOne(query)
            .setOptions({ sanitizeFilter: true })
            .then(result => result.deletedCount);
    }

    protected deleteMany(query: Query): Promise<number> {
        return this.model.deleteMany(query)
            .setOptions({ sanitizeFilter: true })
            .then(result => result.deletedCount);
    }

    protected async updateEntity(query: Query, dao: T): Promise<T> {
        await this.model
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .updateOne(query, dao as any)
            .setOptions({ sanitizeFilter: true })
            .exec();
        return dao;
    }

    protected deleteEntity(query: Query): Promise<void> {
        return this.model
            .deleteMany(query)
            .setOptions({ sanitizeFilter: true })
            .exec()
            .then(() => undefined);
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    protected async findDuplicates(keyFields: string[], options = { allowDiskUse: true }): Promise<Object[]> {
        const _id = keyFields.reduce(
            (acc, field) => ({
                ...acc,
                [field]: `$${field}`
            }),
            {}
        );
        return this.model.aggregate([
            {
                $group: {
                    _id,
                    ids: {
                        $addToSet: "$_id"
                    },
                    count: {
                        $sum: 1
                    }
                }
            },
            {
                $match: {
                    count: {
                        $gte: 2
                    }
                }
            }
        ]).option(options);
    }

    protected aggregate<T>(
        args: mongoose.PipelineStage[],
        options: mongoose.AggregateOptions = { allowDiskUse: true }
    ): mongoose.Aggregate<T[]> {
        /*Please visit following page to get more info, how aggregation works and get know exact args
         https://docs.mongodb.com/manual/core/aggregation-pipeline/
        */
        return this.model.aggregate(args, options)
    }
}
