import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ReaderFeedbackConfig } from "@binders/client/lib/clients/repositoryservice/v3/contract";

export interface ReaderFeedbackConfigDocument extends mongoose.Document {
    itemId: string,
    readerCommentsEnabled: boolean,
    readerRatingEnabled: boolean,
    readConfirmationEnabled: boolean,
}

export interface IReaderFeedbackConfigRepository {
    getForItem(itemId: string): Promise<ReaderFeedbackConfig | undefined>;
    getForItems(itemIds: string[]): Promise<Record<string, ReaderFeedbackConfig>>;
    updateReaderFeedbackConfig(
        itemId: string,
        readerCommentsEnabled: boolean,
        readerRatingEnabled: boolean,
        readConfirmationEnabled: boolean,
    ): Promise<ReaderFeedbackConfig>;
}

export class ReaderFeedbackConfigRepository extends MongoRepository<ReaderFeedbackConfigDocument> implements IReaderFeedbackConfigRepository {

    async getForItem(itemId: string): Promise<ReaderFeedbackConfig | undefined> {
        const readerFeedbackConfig = await this.findOne({ itemId });
        return readerFeedbackConfig == null ? undefined : daoToModel(readerFeedbackConfig);
    }

    async getForItems(itemIds: string[]): Promise<Record<string, ReaderFeedbackConfig>> {
        const readerFeedbackConfigs = await this.findEntities({ itemId: mongoose.trusted({ $in: itemIds.map(String) }) });
        return readerFeedbackConfigs.reduce((acc, config) => {
            acc[config.itemId] = daoToModel(config);
            return acc;
        }, {} as Record<string, ReaderFeedbackConfig>);
    }

    async updateReaderFeedbackConfig(
        itemId: string,
        readerCommentsEnabled: boolean = undefined,
        readerRatingEnabled: boolean = undefined,
        readConfirmationEnabled: boolean = undefined,
    ): Promise<ReaderFeedbackConfig> {
        const readerFeedbackConfig = await this.getForItems([itemId]);
        const dao = await this.upsert(
            { itemId },
            {
                ...(readerFeedbackConfig || {}),
                ...(readerCommentsEnabled !== undefined ? { readerCommentsEnabled } : {}),
                ...(readerRatingEnabled !== undefined ? { readerRatingEnabled } : {}),
                ...(readConfirmationEnabled !== undefined ? { readConfirmationEnabled } : {}),
            } as ReaderFeedbackConfigDocument,
        );
        return daoToModel(dao)
    }

}

export class ReaderFeedbackConfigRepositoryFactory extends MongoRepositoryFactory<ReaderFeedbackConfigDocument> {
    build(logger: Logger): ReaderFeedbackConfigRepository {
        return new ReaderFeedbackConfigRepository(this.model, this.collection, logger)
    }

    updateModel(): void {
        const schema = getReaderFeedbackConfigSchema(this.collection.name);
        schema.index({ itemId: 1 }, { unique: true });
        this.model = this.collection.connection.model<ReaderFeedbackConfigDocument>("ReaderFeedbackConfigDAO", schema)
    }
}

function getReaderFeedbackConfigSchema(collection: string): mongoose.Schema {
    return new mongoose.Schema({
        itemId: {
            type: String,
            required: true
        },
        readerCommentsEnabled: {
            type: Boolean,
            required: true
        },
        readerRatingEnabled: {
            type: Boolean,
            required: true
        },
        readConfirmationEnabled: {
            type: Boolean,
            required: true,
        }
    }, { collection })
}

function daoToModel(dao: ReaderFeedbackConfigDocument): ReaderFeedbackConfig {
    return {
        itemId: dao.itemId,
        readerCommentsEnabled: dao.readerCommentsEnabled,
        readerRatingEnabled: dao.readerRatingEnabled,
        readConfirmationEnabled: dao.readConfirmationEnabled,
    };
}
