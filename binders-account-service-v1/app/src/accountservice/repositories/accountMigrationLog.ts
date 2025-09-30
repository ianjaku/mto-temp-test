import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { AccountMigrationLog } from "../model";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import UUID from "@binders/client/lib/util/uuid";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface AccountMigrationLogRepository {
    log(entity: AccountMigrationLog): Promise<void>;
    findLog(runId: string, migratedEntity: string): Promise<AccountMigrationLog>;
}

export interface AccountMigrationLogDoc extends mongoose.Document {
    id: string;
    runId: string;
    fromAccountId: string;
    toAccountId: string;
    migratedEntity: string;
    details: Record<string, unknown>;
}

function getAccountMigrationLogSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema(
        {
            id: {
                type: String,
                required: true
            },
            runId: {
                type: String,
                required: true
            },
            fromAccountId: {
                type: String,
                required: true,
            },
            toAccountId: {
                type: String,
                required: true,
            },
            migratedEntity: {
                type: String,
                required: true,
            },
            details: {
                type: mongoose.Schema.Types.Mixed,
                required: false,
            }
        },
        { collection: collectionName }
    );
    return addTimestampMiddleware(schema, "updated");
}

function accountMigrationLogDaoToModel(dao: AccountMigrationLogDoc): AccountMigrationLog {
    return {
        runId: dao.runId,
        fromAccountId: dao.fromAccountId,
        toAccountId: dao.toAccountId,
        migratedEntity: dao.migratedEntity,
        details: dao.details,
    };
}

export class MongoAccountMigrationLogRepositoryFactory extends MongoRepositoryFactory<AccountMigrationLogDoc> {
    protected updateModel(): void {
        const schema = getAccountMigrationLogSchema(this.collection.name);
        schema.index({ id: 1, runId: 1, migratedEntity: 1 }, { unique: true });
        this.model = this.collection.connection.model<AccountMigrationLogDoc>("AccountMigrationLogDAO", schema);
    }

    build(logger: Logger): MongoAccountMigrationLogRepository {
        return new MongoAccountMigrationLogRepository(this.model, this.collection, logger);
    }
}

export class MongoAccountMigrationLogRepository extends MongoRepository<AccountMigrationLogDoc> implements AccountMigrationLogRepository {

    async log(entity: AccountMigrationLog): Promise<void> {
        await this.insertEntity({
            id: UUID.randomWithPrefix("aml-"),
            runId: entity.runId,
            fromAccountId: entity.fromAccountId,
            toAccountId: entity.toAccountId,
            migratedEntity: entity.migratedEntity,
            details: entity.details,
        } as AccountMigrationLogDoc)
    }

    async findLog(runId: string, migratedEntity: string): Promise<AccountMigrationLog> {
        const dao = await this.findOne({ runId, migratedEntity });
        return dao == null ? null : accountMigrationLogDaoToModel(dao);
    }
}
