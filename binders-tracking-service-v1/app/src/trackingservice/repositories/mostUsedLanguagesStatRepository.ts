import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { IMostUsedLanguagesStatDAO, MONGOOSE_SCHEMA, MostUsedLanguagesStat } from "../models/mostUsedLanguagesStat";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

function getEventSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema(MONGOOSE_SCHEMA, { collection: collectionName });
}

export interface MostUsedLanguagesStatRepository {
    addMostUsedLanguagesStat(mostUsedLanguagesStat: MostUsedLanguagesStat): Promise<MostUsedLanguagesStat>;
    findMostUsedLanguagesStat(accountId: string): Promise<MostUsedLanguagesStat>;
}

export class MongoMostUsedLanguagesStatRepository extends MongoRepository<IMostUsedLanguagesStatDAO> implements MostUsedLanguagesStatRepository {
    async addMostUsedLanguagesStat(aggregation: MostUsedLanguagesStat): Promise<MostUsedLanguagesStat> {
        await this.deleteEntity({
            accountId: aggregation.accountId,
        });
        const dao: IMostUsedLanguagesStatDAO = await this.insertEntity(aggregation.toDAO());
        return MostUsedLanguagesStat.parse(dao);
    }

    async findMostUsedLanguagesStat(accountId: string): Promise<MostUsedLanguagesStat> {
        const daos = await this.findEntities({ accountId });
        return !daos || daos.length === 0 ? undefined : MostUsedLanguagesStat.parse(daos[0]);
    }
}

export class MongoMostUsedLanguagesStatRepositoryFactory extends MongoRepositoryFactory<IMostUsedLanguagesStatDAO> {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new MongoMostUsedLanguagesStatRepository(this.model, this.collection, logger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    protected updateModel() {
        const schema = getEventSchema(this.collection.name);
        schema.index({ account_id: 1 });
        this.model = this.collection.connection.model<IMostUsedLanguagesStatDAO>("AggregationDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoMostUsedLanguagesStatRepositoryFactory> {
        const loginOption = getMongoLogin("tracking_service");
        return CollectionConfig.fromConfig(config, "mostUsedLanguageStats", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoMostUsedLanguagesStatRepositoryFactory(collectionConfig, logger));
    }
}
