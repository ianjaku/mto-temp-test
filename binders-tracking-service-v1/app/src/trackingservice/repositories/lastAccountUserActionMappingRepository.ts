import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    ILastAccountUserActionsMappingDAO,
    LastAccountUserActionsMapping,
    MONGOOSE_SCHEMA
} from "../models/lastAccountUserActionMapping";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Maybe } from "@binders/client/lib/monad";

export interface ILastAccountUserActionsMappingRepository {
    getLastUserActionsForAccount(accountId: string): Promise<Maybe<LastAccountUserActionsMapping>>;
    setLastUserActionsForAccount(dto: LastAccountUserActionsMapping): Promise<LastAccountUserActionsMapping>;
}

export class MongoLastAccountUserActionsMappingRepository extends MongoRepository<ILastAccountUserActionsMappingDAO> implements ILastAccountUserActionsMappingRepository {
    async getLastUserActionsForAccount(accountId: string): Promise<Maybe<LastAccountUserActionsMapping>> {
        const daos = await this.findEntities({ accountId });
        if (daos.length === 0) {
            return Maybe.nothing();
        }
        return Maybe.just(daos[daos.length-1])
            .lift(v => LastAccountUserActionsMapping.parse(v));
    }

    async setLastUserActionsForAccount(dto: LastAccountUserActionsMapping): Promise<LastAccountUserActionsMapping> {
        const dao = await this.upsert({ accountId: dto.accountId }, dto.toDao());
        return LastAccountUserActionsMapping.parse(dao);
    }
}

export class MongoLastAccountUserActionsMappingRepositoryFactory extends MongoRepositoryFactory<ILastAccountUserActionsMappingDAO> {
    build(logger: Logger): MongoLastAccountUserActionsMappingRepository {
        return new MongoLastAccountUserActionsMappingRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getLastAccountUserActionsSchema(this.collection.name);
        schema.index({ accountId: 1 }, { unique: true });
        this.model = this.collection.connection.model<ILastAccountUserActionsMappingDAO>("LastAccountUserActionsMappingDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoLastAccountUserActionsMappingRepositoryFactory> {
        const loginOption = getMongoLogin("tracking_service");
        return CollectionConfig.fromConfig(config, "lastAccountUserActionsMapping", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(CollectionConfig => new MongoLastAccountUserActionsMappingRepositoryFactory(CollectionConfig, logger));
    }
}
function getLastAccountUserActionsSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema(MONGOOSE_SCHEMA, { collection: collectionName });
}