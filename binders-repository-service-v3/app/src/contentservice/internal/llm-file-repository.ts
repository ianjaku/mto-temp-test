import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { LlmFile } from "./llm";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export interface ILlmFileRepository {
    save(operationLog: LlmFile): Promise<LlmFile>;
    getByFileId(fileId: string): Promise<LlmFile>;
}

export interface LlmFileModel extends mongoose.Document {
    fileId: string;
    name: string;
    uri: string;
    mimeType: string;
    sizeBytes: string;
}

function getLlmFilesSchema(collectionName: string): mongoose.Schema {
    return new mongoose.Schema({
        fileId: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        uri: {
            type: String,
            required: true
        },
        mimeType: {
            type: String,
            required: true
        },
        sizeBytes: {
            type: String,
            required: true
        },
    }, { collection: collectionName });
}

function daoToModel(dao: LlmFileModel): LlmFile {
    return {
        fileId: dao.fileId,
        name: dao.name,
        uri: dao.uri,
        mimeType: dao.mimeType,
        sizeBytes: dao.sizeBytes,
    };
}

function modelToDao(model: LlmFile): LlmFileModel {
    return <LlmFileModel>{
        fileId: model.fileId,
        name: model.name,
        uri: model.uri,
        mimeType: model.mimeType,
        sizeBytes: model.sizeBytes,
    }
}

export class MongoLlmFileRepository
    extends MongoRepository<LlmFileModel>
    implements ILlmFileRepository {

    async save(log: LlmFile): Promise<LlmFile> {
        const dao = modelToDao(log);
        await this.insertEntity(dao);
        return log;
    }

    async getByFileId(fileId: string): Promise<LlmFile> {
        const dao = await this.findOne({ fileId })
        return daoToModel(dao);
    }
}

export class LlmFileRepositoryFactory extends MongoRepositoryFactory<LlmFileModel> {
    build(logger: Logger): MongoLlmFileRepository {
        return new MongoLlmFileRepository(
            this.model,
            this.collection,
            logger
        )
    }

    updateModel(): void {
        const schema = getLlmFilesSchema(this.collection.name);
        schema.index({ fileId: 1 }, { unique: true });
        this.model = this.collection.connection.model<LlmFileModel>(
            "LlmFileDAO",
            schema
        );
    }
}
