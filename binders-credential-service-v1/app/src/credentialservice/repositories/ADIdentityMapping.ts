import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { isMongoDuplicateKeyError } from "@binders/binders-service-common/lib/mongo/util";

export interface ADIdentityMappingRepository {
    getUserId(nameID: string): Promise<string>;
    saveUserMapping(nameID: string, userId: string): Promise<void>;
    multigetNameIDs(userIds: string[]): Promise<Record<string, string>>;
    deleteADIdentityMappingForUsers(userIds: string[]): Promise<void>;
}

export interface IADIdentityUserMapping extends mongoose.Document {
    nameID: string;
    userId: string;
}

const getADIdentityMappingSchema: (name: string) => mongoose.Schema = (collectionName) => {
    return new mongoose.Schema({
        userId: {
            type: String,
            required: true
        },
        nameID: {
            type: String,
            required: true
        },
        created: {
            type: Date,
            default: Date.now
        },
    }, { collection: collectionName });
};

export class MongoADIdentityMappingRepository extends MongoRepository<IADIdentityUserMapping> implements ADIdentityMappingRepository {
    async getUserId(nameID: string): Promise<string> {
        const mappingOption = await this.fetchOne({ nameID });
        if (mappingOption.isNothing()) {
            return undefined;
        }
        const mapping = mappingOption.get();
        return mapping.userId;
    }

    async saveUserMapping(nameID: string, userId: string): Promise<void> {
        try {
            await this.insertEntity({ userId, nameID } as IADIdentityUserMapping);
        } catch (e) {
            if (isMongoDuplicateKeyError(e)) {
                // We may end up in this case when two separate accounts are importing the same user.
                // This could happen when migrating accounts or testing purposes.
                // As long as the document is the same, there's no need to fail the insertion.
                const existing = await this.findOne({ nameID });
                if (existing && existing.userId === userId) {
                    return;
                }
            }
            throw e;
        }
    }

    async multigetNameIDs(userIds: string[]): Promise<Record<string, string>> {
        const mappings = await this.findEntities({ userId: mongoose.trusted({ $in: userIds.map(String) }) });
        return mappings.reduce((acc, mapping) => {
            acc[mapping.userId] = mapping.nameID;
            return acc;
        }, {});
    }

    async deleteADIdentityMappingForUsers(userIds: string[]): Promise<void> {
        await this.deleteMany({ userId: mongoose.trusted({ $in: userIds.map(id => id.toString()) }) });
    }
}

export class MongoADIdentityMappingRepositoryFactory extends MongoRepositoryFactory<IADIdentityUserMapping> {
    build(logger: Logger): MongoADIdentityMappingRepository {
        return new MongoADIdentityMappingRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getADIdentityMappingSchema(this.collection.name);
        schema.index({ userId: 1 });
        schema.index({ nameID: 1 }, { unique: true });
        this.model = this.collection.connection.model<IADIdentityUserMapping>("ADIdentityUserMappingDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoADIdentityMappingRepositoryFactory> {
        const loginOption = getMongoLogin("credential_service");
        return CollectionConfig.fromConfig(config, "credentials", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoADIdentityMappingRepositoryFactory(collectionConfig, logger));
    }
}
