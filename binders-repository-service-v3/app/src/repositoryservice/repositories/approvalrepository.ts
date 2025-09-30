import * as mongoose from "mongoose";
import { ApprovedStatus, ChunkApprovalFilterIds, IChunkApproval as ClientChunkApproval } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { difference, xprod } from "ramda";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import UUID from "@binders/client/lib/util/uuid";

export interface IChunkApproval extends mongoose.Document {
    uuid?: string;
    binderId: string;
    chunkId: string;
    chunkLastUpdate: number;
    chunkLanguageCode: string;
    approved: ApprovedStatus;
    approvedByUser: string;
    approvedAt: number;
}

function daoToModel(dao: IChunkApproval): ClientChunkApproval {
    return {
        uuid: dao.uuid,
        binderId: dao.binderId,
        chunkId: dao.chunkId,
        chunkLastUpdate: dao.chunkLastUpdate,
        chunkLanguageCode: dao.chunkLanguageCode,
        approved: dao.approved,
        approvedByUser: dao.approvedByUser,
        approvedAt: dao.approvedAt,
    };
}

function getIChunkApprovalSchema(collection: string): mongoose.Schema {
    return new mongoose.Schema({
        uuid: {
            type: String,
            required: true,
        },
        binderId: {
            type: String,
            required: true,
        },
        chunkId: {
            type: String,
            required: true,
        },
        chunkLastUpdate: {
            type: Number,
            required: true,
        },
        chunkLanguageCode: {
            type: String,
            required: true,
        },
        approved: {
            type: String,
            required: true,
            default: ApprovedStatus.UNKNOWN,
        },
        approvedByUser: {
            type: String,
            required: true,
        },
        approvedAt: {
            type: Number,
            required: true,
        },
    }, { collection });
}

export interface IChunkApprovalRepository {
    upsertChunkApproval(
        binderId: string,
        chunkId: string,
        chunkLastUpdate: number,
        chunkLanguageCode: string,
        approved: ApprovedStatus,
        userId: string,
    ): Promise<ClientChunkApproval>;
    updateChunkApprovals(binderId: string, filter: ChunkApprovalFilterIds, propsToUpdate: Partial<IChunkApproval>, userId: string): Promise<ClientChunkApproval[]>;
    listChunkApprovalsForBinder(binderId: string): Promise<ClientChunkApproval[]>;
    findMostRecentChunkApprovals(binderIds: string[], options?: { onlyApprovals?: ApprovedStatus[] }): Promise<ClientChunkApproval[]>;
    getChunkApprovalByUUID(uuid: string): Promise<ClientChunkApproval>;
    changeApprovalsLanguage(binderId: string, oldLanguageCode: string, newLanguageCode: string): Promise<void>;
    deleteApprovalsForBinder(binderId: string): Promise<void>;
}

export class MongoChunkApprovalRepository extends MongoRepository<IChunkApproval> implements IChunkApprovalRepository {

    async deleteApprovalsForBinder(binderId: string): Promise<void> {
        if (binderId == null) throw new Error("binderId is required to deleteApprovalsForBinder");
        await this.deleteMany({ binderId });
    }

    async upsertChunkApproval(
        binderId: string,
        chunkId: string,
        chunkLastUpdate: number,
        chunkLanguageCode: string,
        approved: ApprovedStatus,
        userId: string,
    ): Promise<ClientChunkApproval> {
        const exists = (await this.fetchOne({ binderId, chunkId, chunkLanguageCode }))?.isJust();
        if (exists) {
            const upsertedChunkApproval = await this.updateChunkApprovals(
                binderId,
                { chunkIds: [chunkId], chunkLanguageCodes: [chunkLanguageCode] },
                {
                    chunkLastUpdate,
                    chunkLanguageCode,
                    approved,
                    approvedAt: Date.now(),
                    approvedByUser: userId,
                },
                userId,
            );
            return [...upsertedChunkApproval].pop();
        }
        const dao = await this.insertEntity({
            uuid: UUID.randomWithPrefix("app-") as string,
            binderId,
            chunkId,
            chunkLastUpdate,
            chunkLanguageCode,
            approved,
            approvedByUser: userId,
            approvedAt: Date.now(),
        } as IChunkApproval);
        return daoToModel(dao);
    }

    async updateChunkApprovals(
        binderId: string,
        filter: ChunkApprovalFilterIds,
        propsToUpdate: Partial<IChunkApproval>,
        userId: string,
    ): Promise<ClientChunkApproval[]> {
        const queryAllApprovals = {
            binderId,
            chunkId: mongoose.trusted({ $in: filter.chunkIds.map(String) }),
            ...(filter.chunkLanguageCodes ? { chunkLanguageCode: mongoose.trusted({ $in: filter.chunkLanguageCodes.map(String) }) } : {}),
        };
        const queryApprovalsWithStatus = {
            ...queryAllApprovals,
            ...(filter.approvalStatus ? { approved: filter.approvalStatus } : {}),
        }

        const existingApprovals = await this.findEntities(queryAllApprovals);
        const missingApprovals = difference(
            xprod(filter.chunkIds, filter.chunkLanguageCodes) as [string, string][],
            existingApprovals.map(ap => [ap.chunkId, ap.chunkLanguageCode] as [string, string]),
        );

        const newApprovals = missingApprovals.map(([chunkId, languageCode]) => ({
            uuid: UUID.randomWithPrefix("app-") as string,
            binderId,
            chunkId,
            chunkLastUpdate: Date.now(),
            chunkLanguageCode: languageCode,
            approved: ApprovedStatus.UNKNOWN,
            approvedByUser: userId,
            approvedAt: Date.now(),
        } as IChunkApproval));

        await this.insertMany(newApprovals);
        await this.updateMany(queryApprovalsWithStatus, {
            $set: propsToUpdate,
        });

        const matchesDAOs = await this.findEntities(queryApprovalsWithStatus);

        return matchesDAOs.map(daoToModel);
    }

    async listChunkApprovalsForBinder(binderId: string): Promise<ClientChunkApproval[]> {
        const approvalsDAOs = await this.findEntities({ binderId });
        return approvalsDAOs.map(daoToModel);
    }

    private getSchemaAttributes(): string[] {
        const schema = getIChunkApprovalSchema(this.collection.name);
        return Object.keys(schema.paths).filter(v => !v.startsWith("_"));
    }

    async findMostRecentChunkApprovals(binderIds: string[], options: { onlyApprovals?: ApprovedStatus[] } = {}): Promise<ClientChunkApproval[]> {
        const groupAttributes = {};
        for (const attribute of this.getSchemaAttributes()) {
            groupAttributes[attribute] = { "$first": `$${attribute}` };
        }

        const query = { binderId: mongoose.trusted({ $in: binderIds.map(String) }) };
        if (options?.onlyApprovals != null) {
            query["approved"] = mongoose.trusted({ $in: options.onlyApprovals.map(String) })
        }

        /**
         * Using aggregate instead of match here, because for some reason aggregate has better execution plan selection
         * when it comes to composite indices ¯\_(ツ)_/¯
         */
        return this.aggregate([{ $match: query }]);
    }

    async getChunkApprovalByUUID(uuid: string): Promise<ClientChunkApproval> {
        const result = await this.fetchOne({ uuid });
        const output = result.isJust() ? daoToModel(result.get()) : undefined;
        return output;
    }

    async changeApprovalsLanguage(binderId: string, oldLanguageCode: string, newLanguageCode: string): Promise<void> {
        await this.updateMany(
            { binderId, chunkLanguageCode: oldLanguageCode },
            { $set: { chunkLanguageCode: newLanguageCode } }
        )
    }
}

export class ChunkApprovalRepositoryFactory extends MongoRepositoryFactory<IChunkApproval> {
    build(logger: Logger): MongoChunkApprovalRepository {
        return new MongoChunkApprovalRepository(
            this.model,
            this.collection,
            logger,
        );
    }

    updateModel(): void {
        const schema = getIChunkApprovalSchema(this.collection.name);
        schema.index({ uuid: 1 }, { unique: true });
        schema.index({ binderId: 1, chunkId: 1, chunkLanguageCode: 1 }, { unique: true });
        this.model = this.collection.connection.model<IChunkApproval>("ChunkApprovalDAO", schema);
    }
}
