import * as mongoose from "mongoose";
import {
    DEFAULT_FEATURES,
    FeaturesByAccount,
    IFeature as IFeatureContract,
    IUpdateFeaturesOptions,
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging"
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema"

export interface AccountFeaturesRepository {
    createAccountFeatures(accountId: string): Promise<void>;
    getAllFeaturesByAccount(): Promise<FeaturesByAccount>;
    getAccountFeatures(accountId: string): Promise<string[]>;
    updateAccountFeatures(accountId: string, featuresMap: IFeature[], options?: IUpdateFeaturesOptions): Promise<string[]>;
    deleteAccountFeatures(accountId: string): Promise<void>;
    getAccountIdsByFeatures(features: IFeatureContract[]): Promise<string[]>;
}

interface IFeature {
    feature: string;
    enabled: boolean;
}

export interface IAccountFeatures extends mongoose.Document {
    accountId: string;
    features: string[];
    featuresMap: IFeature[];
}

const getAccountFeaturesSchema: (collectionName: string) => mongoose.Schema = collectionName => {
    const schema = new mongoose.Schema(
        {
            accountId: {
                type: String,
                required: true,
                unique: true
            },
            features: {
                type: [String],
                default: DEFAULT_FEATURES.map(f => f.feature),
            },
            featuresMap: {
                type: [{
                    feature: {
                        type: String,
                        required: true,
                    },
                    enabled: {
                        type: Boolean,
                        required: true,
                    }
                }],
                default: DEFAULT_FEATURES,
            },
            created: {
                type: Date,
                default: Date.now
            },
            updated: {
                type: Date,
                default: Date.now
            }
        }, { collection: collectionName })
    return addTimestampMiddleware(schema, "updated");
};

export class MongoAccountFeaturesRepository extends MongoRepository<IAccountFeatures> implements AccountFeaturesRepository {

    async getAllFeaturesByAccount(): Promise<{ features: string[]; accountId: string; }[]> {
        const allEntities = await this.getAccountFeaturesList();
        return allEntities.map(entity => {
            return {
                accountId: entity.accountId,
                features: this.featuresToStrings(entity.featuresMap),
            }
        });
    }

    async getAccountFeaturesList(): Promise<IAccountFeatures[]> {
        return await this.findEntities({});
    }

    async getAccountFeatures(accountId: string): Promise<string[]> {
        const featuresMap = await this.getFeaturesMap(accountId);
        return this.featuresToStrings(featuresMap);
    }

    async createAccountFeatures(accountId: string): Promise<void> {
        const accountFeatures = new this.model({ accountId });
        await accountFeatures.save();
    }

    async convertAccountFeatures(accountId: string, features: string[]): Promise<string[]> {
        const defaultFeatures = DEFAULT_FEATURES.map(f => f.feature);
        const nonDefaultFeatures = features.filter(
            f => defaultFeatures.indexOf(f) === -1,
        );
        const featuresMap = [
            ...DEFAULT_FEATURES,
            ...nonDefaultFeatures.map(f => ({ feature: f, enabled: true })),
        ];
        const savedAccountFeatures = await this.saveEntity(
            { accountId },
            { accountId, features, featuresMap } as IAccountFeatures,
        );
        return this.featuresToStrings(savedAccountFeatures.featuresMap);
    }

    async updateAccountFeatures(accountId: string, newFeatures: IFeature[], options?: IUpdateFeaturesOptions): Promise<string[]> {
        const currentFeaturesMap = await this.getFeaturesMap(accountId);
        const doReplace = options && options.doReplace;
        const featuresMap = doReplace ?
            newFeatures :
            [
                ...currentFeaturesMap.filter(({ feature: currentFeature }) => newFeatures.map(f => f.feature).findIndex(f => f === currentFeature) === -1),
                ...newFeatures,
            ];
        const savedAccountFeatures = await this.saveEntity(
            { accountId },
            { accountId, featuresMap } as IAccountFeatures,
        );
        return this.featuresToStrings(savedAccountFeatures.featuresMap);
    }

    async deleteAccountFeatures(accountId: string): Promise<void> {
        await this.deleteEntity({ accountId });
    }

    async getAccountIdsByFeatures(features: IFeatureContract[]): Promise<string[]> {
        const featureSets = await this.findEntities({
            featuresMap: mongoose.trusted({
                $elemMatch: {
                    $and: features.map(f => ({ feature: f, enabled: true })),
                },
            }),
        });
        return featureSets.map(f => f.accountId);
    }

    private featuresToStrings(featuresMap): string[] {
        return featuresMap.filter(f => f.enabled).map(f => f.feature);
    }

    private async getFeaturesMap(accountId: string) {
        const featuresDao = await this.fetchOne({ accountId });
        return featuresDao.isJust() ? featuresDao.get().featuresMap : [];
    }
}

export class MongoAccountFeaturesRepositoryFactory extends MongoRepositoryFactory<IAccountFeatures> {

    build(logger: Logger): MongoAccountFeaturesRepository {
        return new MongoAccountFeaturesRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getAccountFeaturesSchema(this.collection.name);
        this.model = this.collection.connection.model<IAccountFeatures>("AccountFeaturesDAO", schema);
    }
}
