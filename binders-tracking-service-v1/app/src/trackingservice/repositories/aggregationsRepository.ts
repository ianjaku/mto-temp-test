import * as mongoose from "mongoose";
import {
    Aggregation,
    IAggregationDAO,
    IAggregationFilter,
    MONGOOSE_SCHEMA
} from "../models/aggregation";
import {
    AggregatorType,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { __TEMPaggregatorTypeFromUserActionType } from "./helpers";
import { queryFromAggregationFilter } from "./builder";

function getEventSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema(MONGOOSE_SCHEMA, { collection: collectionName });
}

export interface AggregationRepository {
    resetAggregations(accountId: string): Promise<number>;
    saveAggregation(aggregation: Aggregation): Promise<Aggregation>;
    findLastAggregations(accountId: string, filter: IAggregationFilter): Promise<Aggregation[]>;
    getLastAggregations(accountIds: string[], aggregatorType?: AggregatorType): Promise<Aggregation[]>;
    __TEMPsetAggregatorType(): Promise<void>; // TEMP, remove when happy ny release is live
    __TEMPCleanFakeAggregations(): Promise<number>; // TEMP, remove when happy ny release is live
}

export class MongoAggregationsRepository extends MongoRepository<IAggregationDAO> implements AggregationRepository {
    async saveAggregation(aggregation: Aggregation): Promise<Aggregation> {
        await this.deleteEntity({
            accountId: aggregation.accountId,
            aggregatorType: aggregation.aggregatorType,
        });
        const dao: IAggregationDAO = await this.insertEntity(aggregation.toDAO());
        return Aggregation.parse(dao);
    }

    async __TEMPsetAggregatorType(): Promise<void> {
        const allAggregations = await this.model.find({}).setOptions({ sanitizeFilter: true }).exec();
        const updates = [];
        for (const aggregation of allAggregations) {
            updates.push({
                updateOne: {
                    filter: { _id: aggregation._id },
                    update: { $set: { aggregatorType: __TEMPaggregatorTypeFromUserActionType(aggregation.userActionType) } },
                }
            });
        }
        await this.bulkWrite(updates);
    }

    async __TEMPCleanFakeAggregations(): Promise<number> {
        return this.deleteMany({
            userActionType: mongoose.trusted({
                $in: [UserActionType.COLLECTION_VIEW],
            }),
        })
    }

    async getLastAggregations(accountIds: string[], aggregatorType?: AggregatorType): Promise<Aggregation[]> {
        const daos = await this.model.find({
            accountId: mongoose.trusted({ $in: accountIds.map(String) }),
            ...(aggregatorType ? { aggregatorType } : {}),
        })
            .setOptions({ sanitizeFilter: true })
            .sort({ "data.rangeEnd": -1 })
            .exec();
        return !daos || daos.length === 0 ?
            [] :
            daos.map(dao => Aggregation.parse(dao));
    }

    async findLastAggregations(accountId: string, filter: IAggregationFilter): Promise<Aggregation[]> {
        try {
            const query = queryFromAggregationFilter(accountId, filter);
            const results = await this.model.aggregate([
                {
                    $match: query,
                },
                {
                    $group: {
                        _id: {
                            aggregatorType: "$aggregatorType",
                            accountId: "$accountId",
                            data: "$data",
                        },
                        timestamp: { $min: "$timestamp" },
                        timestampLogged: { $max: "$timestamp" }
                    },
                },
                {
                    $sort: {
                        "_id.data.rangeEnd": 1,
                    }
                },
            ]);
            return results.map(result => {
                const { _id, timestamp, timestampLogged } = result;
                const { aggregatorType, accountId, data } = _id;
                return new Aggregation(
                    aggregatorType,
                    timestamp,
                    timestampLogged,
                    accountId,
                    data,
                );
            });
        }
        catch (err) {
            this.logger?.error(err.message || err, "stats");
            throw err;
        }
    }

    async resetAggregations(accountId: string): Promise<number> {
        const query = { accountId };
        return this.deleteMany(query);
    }
}

export class MongoAggregationsRepositoryFactory extends MongoRepositoryFactory<IAggregationDAO> {
    build(logger: Logger): MongoAggregationsRepository {
        return new MongoAggregationsRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getEventSchema(this.collection.name);
        schema.index({ aggregatorType: 1 }, { unique: false });
        schema.index({ account_id: 1 });
        schema.index({ account_id: 1, aggregatorType: 1 });
        // schema.index({ timestamp: 1, user_id: 1, userActionType: 1 }, { unique: true });
        this.model = this.collection.connection.model<IAggregationDAO>("AggregationDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoAggregationsRepositoryFactory> {
        const loginOption = getMongoLogin("tracking_service");
        return CollectionConfig.fromConfig(config, "aggregations", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoAggregationsRepositoryFactory(collectionConfig, logger));
    }
}
