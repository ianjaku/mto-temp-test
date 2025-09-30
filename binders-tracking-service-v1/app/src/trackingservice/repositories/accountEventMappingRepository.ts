import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    ILastAccountEventMappingDAO,
    LastAccountEventMapping,
    MONGOOSE_SCHEMA
} from "../models/lastAccountEventMapping";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { EventType, } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Maybe } from "@binders/client/lib/monad";

export interface ILastAccountEventMappingRepository {
    setLatestEventTimeForAccount(accountEventMapping: LastAccountEventMapping): Promise<LastAccountEventMapping>;
    getLatestEventTimeForAccount(accountId: string, eventTypes: EventType[]): Promise<Maybe<Date>>;
}

function getLastAccountEventMappingSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema(MONGOOSE_SCHEMA, { collection: collectionName });
}

export class MongoLastAccountEventMappingRepository extends MongoRepository<ILastAccountEventMappingDAO> implements ILastAccountEventMappingRepository {

    async setLatestEventTimeForAccount(accountEventMapping: LastAccountEventMapping): Promise<LastAccountEventMapping> {
        const dao = await this.saveEntity(
            {
                accountId: accountEventMapping.accountId,
                eventType: accountEventMapping.eventType,
            },
            accountEventMapping.toDAO()
        );
        return LastAccountEventMapping.parse(dao);
    }

    async getLatestEventTimeForAccount(accountId: string, eventTypes: EventType[]): Promise<Maybe<Date>> {
        const daos = await this.findEntities({
            accountId,
            eventType: mongoose.trusted({ $in: eventTypes.map(Number) }),
        }, {
            orderByField: "time",
            sortOrder: "ascending",
        });
        if (daos.length === 0) {
            // Fallback if there are no event-specific entries; look for an account one (pre - happy ny release)
            const eventLessDaos = await this.findEntities({
                accountId,
                eventType: mongoose.trusted({ $exists: false }),
            });
            if (eventLessDaos.length) {
                return Maybe.just(eventLessDaos[0].time);
            }
        }
        if (daos && daos.length > 0) {
            return Maybe.just([...daos].pop().time);
        }
        return Maybe.nothing();
    }

    async fixDuplicates(): Promise<void> {
        const uniqueItems = {};
        await this.forEachMatchingObject({}, async (item) => {
            const key = `${item.accountId}-${item.eventType}`;
            if (key in uniqueItems) {
                const previousTime = uniqueItems[key].getTime();
                const currentTime = item.time.getTime();
                if (previousTime > currentTime) {
                    await this.deleteOne({
                        accountId: item.accountId,
                        eventType: item.eventType,
                        time: item.time
                    });
                } else {
                    await this.deleteOne({
                        accountId: item.accountId,
                        eventType: item.eventType,
                        time: uniqueItems[key]
                    });
                    uniqueItems[key] = item.time;
                }
            } else {
                uniqueItems[key] = item.time;
            }
        });
    }

}

export class MongoLastAccountEventMappingRepositoryFactory extends MongoRepositoryFactory<ILastAccountEventMappingDAO> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new MongoLastAccountEventMappingRepository(this.model, this.collection, logger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    protected updateModel() {
        const schema = getLastAccountEventMappingSchema(this.collection.name);
        schema.index({ accountId: 1, eventType: 1 }, { unique: true });
        this.model = this.collection.connection.model<ILastAccountEventMappingDAO>("LastAccountEventMappingDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoLastAccountEventMappingRepositoryFactory> {
        const loginOption = getMongoLogin("tracking_service");
        return CollectionConfig.fromConfig(config, "lastAccountEventMapping", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoLastAccountEventMappingRepositoryFactory(collectionConfig, logger));
    }

}
