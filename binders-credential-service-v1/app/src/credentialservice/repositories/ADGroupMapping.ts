import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export interface ADGroupMappingRepository {
    getGroupId(ADGroupId: string, accountId: string): Promise<string>;
    saveGroupMapping(ADGroupId: string, groupId: string, accountId: string): Promise<void>;
    getAllADGroupMappings(accountId): Promise<IADGroupMapping[]>
}

export interface IADGroupMapping extends mongoose.Document {
    ADGroupId: string;
    groupId: string;
    accountId: string;
}

const getADGroupMappingSchema: (name: string) => mongoose.Schema = (collectionName) => {
    return new mongoose.Schema({
        groupId: {
            type: String,
            required: true
        },
        accountId: {
            type: String,
            required: true
        },
        ADGroupId: {
            type: String,
            required: true
        },
        created: {
            type: Date,
            default: Date.now
        },
    }, { collection: collectionName });
};

export class MongoADGroupMappingRepository extends MongoRepository<IADGroupMapping> implements ADGroupMappingRepository {
    async getGroupId(ADGroupId: string, accountId: string): Promise<string> {
        const mappingOption = await this.fetchOne({ ADGroupId, accountId });
        if (mappingOption.isNothing()) {
            return undefined;
        }
        const mapping = mappingOption.get();
        return mapping.groupId;
    }

    async getAllADGroupMappings(accountId: string): Promise<IADGroupMapping[]> {
        return this.findEntities({ accountId });
    }

    async saveGroupMapping(ADGroupId: string, groupId: string, accountId: string): Promise<void> {
        if (!ADGroupId) {
            await this.deleteEntity({ groupId });
        } else {
            const mapping = { groupId, ADGroupId, accountId };
            await this.saveEntity({ groupId }, mapping as IADGroupMapping);
        }
    }
}

export class MongoADGroupMappingRepositoryFactory extends MongoRepositoryFactory<IADGroupMapping> {
    build(logger: Logger): MongoADGroupMappingRepository {
        return new MongoADGroupMappingRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getADGroupMappingSchema(this.collection.name);
        schema.index({ groupId: 1, ADGroupId: 1 }, { unique: true });
        this.model = this.collection.connection.model<IADGroupMapping>("ADGroupMappingDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoADGroupMappingRepositoryFactory> {
        const loginOption = getMongoLogin("credential_service");
        return CollectionConfig.fromConfig(config, "credentials", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoADGroupMappingRepositoryFactory(collectionConfig, logger));
    }
}