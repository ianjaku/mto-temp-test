import * as mongoose from "mongoose";
import {
    ITranscriptSection,
    IVideoIndexerResult,
    IVideoIndexerResultFilter
} from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
(<any>mongoose).MongoosePromise = Promise;

export interface IVideoIndexerRepository {
    saveVideoIndexerResult(videoIndexerResult: IVideoIndexerResult): Promise<IVideoIndexerResult>;
    getVideoIndexerResult(msVideoId: string): Promise<IVideoIndexerResult>;
    findVideoIndexerResults(filter: IVideoIndexerResultFilter): Promise<IVideoIndexerResult[]>;
}

export interface VideoIndexerResultDAO extends mongoose.Document {
    msVideoId: string;
    visualId: string;
    status: number;
    statusExtraInfo: string;
    transcript: ITranscriptSection[];
    created: Date;
    updated: Date;
    accountId: string;
    percentageCompleted: number;
}

export const TranscriptSchema = new mongoose.Schema({
    text: {
        type: String,
        require: true
    },
    speakerId: {
        type: String
    },
    language: {
        type: String
    },
    start: {
        type: String,
        require: true
    },
    end: {
        type: String,
        require: true
    }
});

function getVideoIndexerSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        msVideoId: {
            type: String,
            require: true
        },
        visualId: {
            type: String,
            require: true
        },
        status: {
            type: Number,
            require: true
        },
        statusExtraInfo: {
            type: String,
            require: false
        },
        transcript: {
            type: [TranscriptSchema],
            require: true
        },
        accountId: {
            type: String,
            require: true,
        },
        percentageCompleted: {
            type: Number,
            required: true
        },
        created: {
            type: Date,
            default: Date.now
        },
        updated: {
            type: Date,
            default: Date.now
        }
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export class MongoVideoIndexerRepository extends MongoRepository<VideoIndexerResultDAO> implements IVideoIndexerRepository {

    async saveVideoIndexerResult(videoIndexerResult: IVideoIndexerResult): Promise<IVideoIndexerResult> {
        const dao = <VideoIndexerResultDAO>videoIndexerResult;
        const savedResult = await this.saveEntity({ msVideoId: videoIndexerResult.msVideoId }, dao);
        return savedResult;
    }

    async getVideoIndexerResult(msVideoId: string): Promise<IVideoIndexerResult> {
        return this.fetchOne({ msVideoId }).then(result => {
            if (result.isJust()) {
                return result.get();
            }
            return undefined;
        });
    }

    async findVideoIndexerResults(clientFilter: IVideoIndexerResultFilter): Promise<IVideoIndexerResult[]> {
        const { createdBefore, status, visualIds } = clientFilter
        const query = {
            ...(createdBefore ? { created: mongoose.trusted({ $lt: new Date(clientFilter.createdBefore) }) } : {}),
            ...(status !== null && status !== undefined ? { status } : {}),
            ...(visualIds ? { visualId: mongoose.trusted({ $in: visualIds.map(String) }) } : {}),
        };
        return this.findEntities(query);
    }
}

export interface IVideoIndexerRepositoryFactory {
    build(logger: Logger): IVideoIndexerRepository;
}

export class MongoVideoIndexerRepositoryFactory extends MongoRepositoryFactory<VideoIndexerResultDAO> implements IVideoIndexerRepositoryFactory {

    build(logger: Logger): MongoVideoIndexerRepository {
        return new MongoVideoIndexerRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getVideoIndexerSchema(this.collection.name);
        schema.index({ msVideoId: 1 }, { unique: true });
        this.model = this.collection.connection.model<VideoIndexerResultDAO>("MongoVideoIndexerResultDAO", schema);
    }

}
