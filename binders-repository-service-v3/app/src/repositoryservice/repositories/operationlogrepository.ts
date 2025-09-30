import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { OperationLog } from "./models/operationLog";

type ElasticOperation = "bulk" | "delete" | "index" | "update"
export interface ElasticOperationLog extends mongoose.Document {
    id: string;
    operation: ElasticOperation;
    payload: string;
    timestamp: Date;
}

export interface IElasticOperationLogRepository {
    save(operationLog: OperationLog): Promise<OperationLog>
    getAll(): Promise<OperationLog[]>
    purgeAll(): Promise<number>
}

function getOperationLogSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema({
        id: {
            type: String,
            required: true
        },
        operation: {
            type: String,
            required: true
        },
        payload: {
            type: String,
            required: true
        },
        timestamp: {
            type: String,
            required: true
        },
    }, { collection: collectionName });
}

function daoToModel(operationLog: ElasticOperationLog): OperationLog {
    return new OperationLog(
        operationLog.id,
        operationLog.operation,
        operationLog.payload,
        operationLog.timestamp
    );
}

function modelToDao(operationLog: OperationLog): ElasticOperationLog {
    return <ElasticOperationLog>{
        id: operationLog.id,
        operation: operationLog.operation,
        timestamp: operationLog.timestamp,
        payload: operationLog.payload
    }
}

export class MongoOperationLogRepository
    extends MongoRepository<ElasticOperationLog>
    implements IElasticOperationLogRepository {

    async save(log: OperationLog): Promise<OperationLog> {
        const dao = modelToDao(log);
        await this.insertEntity(dao);
        return log;
    }

    async getAll(): Promise<OperationLog[]> {
        const daos = await this.findEntities({}, { orderByField: "timestamp", sortOrder: "ascending" })
        return daos.map(daoToModel)
    }

    async purgeAll(): Promise<number> {
        return this.deleteMany({})
    }

}

export class OperationLogRepositoryFactory extends MongoRepositoryFactory<ElasticOperationLog> {
    build(logger: Logger): MongoOperationLogRepository {
        return new MongoOperationLogRepository(
            this.model,
            this.collection,
            logger
        )
    }

    updateModel(): void {
        const schema = getOperationLogSchema(this.collection.name);
        schema.index({ id: 1 }, { unique: true }); //todo rethink indices
        this.model = this.collection.connection.model<ElasticOperationLog>(
            "OperationLogDAO",
            schema
        );
    }
}
