import * as mongoose from "mongoose";
import { AuditLog, IAuditLogDAO, MONGOOSE_SCHEMA } from "../models/auditLog";
import {
    AuditLogType,
    IACLAuditLogData
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export interface BatchProcessLogsParams {
    accountId: string;
    type: AuditLogType;
    data?: Record<string, string | string[]>;
    startDate?: Date;
    endDate?: Date;
}

export interface FetchAclLogsParams {
    accountId: string;
    startDate: Date;
    endDate: Date;
    assigneeIds?: string[];
    resourceIds?: string[];
}

export interface FindLogsParams {
    accountId: string;
    logType: AuditLogType;
    startDate?: Date;
    endDate?: Date;
}

export interface IAuditLogRepository {
    logAudition(log: AuditLog): Promise<AuditLog>;
    findLogs(params: FindLogsParams): Promise<AuditLog[]>;
    batchProcessLogs(
        params: BatchProcessLogsParams,
        callback: (logs: AuditLog[]) => Promise<void> | void
    ): Promise<void>;
    fetchAclLogs(params: FetchAclLogsParams): Promise<AuditLog<IACLAuditLogData>[]>;
}

function getEventSchema(collectionName: string): mongoose.Schema {
    return new mongoose.Schema(MONGOOSE_SCHEMA, { collection: collectionName });
}

export class MongoAuditLogRepository extends MongoRepository<IAuditLogDAO> implements IAuditLogRepository {

    async fetchAclLogs(params: FetchAclLogsParams): Promise<AuditLog<IACLAuditLogData>[]> {
        const query = {
            accountId: params.accountId,
            logType: AuditLogType.ACL_UPDATE,
        }
        if (params.endDate || params.startDate) {
            query["timestamp"] = {
                ...(params.startDate ? mongoose.trusted({ $gte: new Date(params.startDate) }) : {}),
                ...(params.endDate ? mongoose.trusted({ $lte: new Date(params.endDate) }) : {}),
            }
        }
        if (params.assigneeIds != null && params.assigneeIds.length > 0) {
            query["$or"] = [
                {
                    "data.oldAcl.assignees": mongoose.trusted({
                        $elemMatch: {
                            ids: { $in: params.assigneeIds.map(String) }
                        }
                    }),
                },
                {
                    "data.newAcl.assignees": mongoose.trusted({
                        $elemMatch: {
                            ids: { $in: params.assigneeIds.map(String) }
                        }
                    })
                }
            ]
        }
        if (params.resourceIds != null && params.resourceIds.length > 0) {
            const or = [
                {
                    "data.oldAcl.rules": mongoose.trusted({
                        $elemMatch: {
                            "resource.ids": { $in: params.resourceIds.map(String) }
                        }
                    }),
                    "data.newAcl.rules": mongoose.trusted({
                        $elemMatch: {
                            "resource.ids": { $in: params.resourceIds.map(String) }
                        }
                    }),
                }
            ]
            if (query["$or"] == null) {
                query["$or"] = or;
            } else {
                query["$and"] = [
                    { "$or": or },
                    { "$or": query["$or"] }
                ]
                delete query["$or"];
            }
        }
        const entities = await this.findEntities(query);
        return entities.map(AuditLog.fromDAO) as AuditLog<IACLAuditLogData>[];
    }

    batchProcessLogs(
        params: BatchProcessLogsParams,
        callback: (logs: AuditLog[]) => Promise<void> | void
    ): Promise<void> {
        const query = {
            accountId: params.accountId,
            logType: params.type
        }
        if (params.endDate || params.startDate) {
            query["timestamp"] = {
                ...(params.startDate ? mongoose.trusted({ $gte: params.startDate }) : {}),
                ...(params.endDate ? mongoose.trusted({ $lte: params.endDate }) : {}),
            }
        }
        if (params.data) {
            Object.keys(params.data).forEach(key => {
                const value = params.data[key];
                if (Array.isArray(value)) {
                    query["data." + key] = mongoose.trusted({ $in: value.map(String) });
                } else {
                    query["data." + key] = value;
                }
            })
        }
        return this.batchProcess(query, auditLogDaos => {
            return Promise.resolve(
                callback(
                    auditLogDaos.map(AuditLog.fromDAO)
                )
            );
        });
    }

    async logAudition(log: AuditLog): Promise<AuditLog> {
        const dao: IAuditLogDAO = await this.insertEntity(log.toDAO());
        return AuditLog.parse(dao);
    }

    async findLogs(params: FindLogsParams): Promise<AuditLog[]> {
        const query = {
            accountId: params.accountId,
            logType: params.logType,
        };
        if (params.endDate || params.startDate) {
            query["timestamp"] = {
                ...(params.startDate ? mongoose.trusted({ $gte: params.startDate }) : {}),
                ...(params.endDate ? mongoose.trusted({ $lte: params.endDate }) : {}),
            }
        }
        const daos = await this.findEntities(query, {})
        return daos.map(AuditLog.fromDAO);
    }
}

export class AuditLogRepositoryFactory extends MongoRepositoryFactory<IAuditLogDAO> {
    build(logger: Logger): MongoAuditLogRepository {
        return new MongoAuditLogRepository(
            this.model,
            this.collection,
            logger,
        );
    }

    protected updateModel(): void {
        const schema = getEventSchema(this.collection.name);
        schema.index({ userId: 1 }, { unique: false });
        schema.index({ logType: 1 }, { unique: false });
        schema.index({ accountId: 1 });
        schema.index({ accountId: 1, logType: 1 });
        schema.index({ timestamp: 1, userId: 1, logType: 1 }, { unique: false });
        this.model = this.collection.connection.model<IAuditLogDAO>("AuditLogDAO", schema);
    }

    static async fromConfig(config: Config, logger: Logger): Promise<AuditLogRepositoryFactory> {
        const loginOption = getMongoLogin("tracking_service");
        const collectionConfig = await CollectionConfig.fromConfig(config, "auditLog", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            });
        return new AuditLogRepositoryFactory(collectionConfig, logger);
    }
}
