import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { IPartialBoundary } from "@binders/client/lib/highlight/highlight";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { TTSMeta } from "./models/ttsmeta";

export interface ITTSMeta extends mongoose.Document {
    id: string;
    language: string;
    paragraphs: string[];
    boundaries: IPartialBoundary[];
    fileName: string;
}

export interface ITTSRepository {
    storeTTSMeta(ttsFile: TTSMeta): Promise<TTSMeta>;
    fetchTTSMeta(id: string): Promise<TTSMeta | null>;
}

function getTTSFileSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema({
        id: {
            type: String,
            required: true
        },
        language: {
            type: String,
            required: true
        },
        fileName: {
            type: String,
            required: true
        },
        paragraphs: {
            type: [String],
            required: true
        },
        boundaries: {
            type: [{
                text: String,
                offsetMS: Number
            }],
            required: true
        }
    }, { collection: collectionName } );
}

function daoToModel(ttsMeta: ITTSMeta): TTSMeta {
    return new TTSMeta(
        ttsMeta.id,
        ttsMeta.language,
        ttsMeta.paragraphs,
        ttsMeta.boundaries,
        ttsMeta.fileName
    );
}

function modelToDao(ttsMeta: TTSMeta): ITTSMeta {
    return <ITTSMeta>{
        id: ttsMeta.id,
        language: ttsMeta.language,
        paragraphs: ttsMeta.paragraphs,
        boundaries: ttsMeta.boundaries,
        fileName: ttsMeta.fileName
    }
}

export class MongoTTSRepository
    extends MongoRepository<ITTSMeta>
    implements ITTSRepository
{

    async storeTTSMeta(ttsFile: TTSMeta): Promise<TTSMeta> {
        const dao = modelToDao(ttsFile);
        await this.insertEntity(dao);
        return ttsFile;
    }

    async fetchTTSMeta(id: string): Promise<TTSMeta | null> {
        const result = await this.fetchOne({ id });
        if (result.isJust()) {
            return daoToModel(result.get());
        }
        return null;
    }

}

export class TTSRepositoryFactory extends MongoRepositoryFactory<ITTSMeta> {
    build(logger: Logger): MongoTTSRepository {
        return new MongoTTSRepository(
            this.model,
            this.collection,
            logger
        )
    }

    updateModel(): void {
        const schema = getTTSFileSchema(this.collection.name);
        schema.index({id: 1}, {unique: true});
        this.model = this.collection.connection.model<ITTSMeta> (
            "TTSMetaDAO",
            schema
        );
    }
}
