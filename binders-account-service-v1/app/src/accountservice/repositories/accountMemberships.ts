import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { isBefore, subHours } from "date-fns";
import { AccountMembership } from "../model";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface AccountMembershipRepository {
    updateMemberCount(accountId: string, memberCount: number, manualToMemberCount: number): Promise<void>;
    findForAccount(accountId: string): Promise<AccountMembership[]>;
    deleteAccountMembership(accountId: string): Promise<void>;
}

/**
 * Starting March release 2024 {@link memberCount} was changed and now represents
 * the number of non-Manual.to users while the {@link manualToMemberCount} represents
 * the number of Manual.to users in an account.
 */
export interface IAccountMembershipDoc extends mongoose.Document {
    id: string;
    accountId: string;
    memberCount: number;
    manualToMemberCount: number;
    start: Date;
    end: Date;
}

function getAccountMembershipsSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema(
        {
            accountId: {
                type: String,
                required: true
            },
            start: {
                type: Date,
                required: true
            },
            end: {
                type: Date,
            },
            memberCount: {
                type: Number,
                required: true,
            },
            manualToMemberCount: {
                type: Number,
                default: 0,
            },
            created: {
                type: Date,
                default: Date.now
            },
            updated: {
                type: Date,
                default: Date.now
            }
        },
        { collection: collectionName }
    );
    return addTimestampMiddleware(schema, "updated");
}

function accountMembershipDaoToModel(dao: IAccountMembershipDoc): AccountMembership {
    return {
        accountId: dao.accountId,
        memberCount: dao.memberCount,
        manualToMemberCount: dao.manualToMemberCount ?? 0,
        start: dao.start,
        end: dao.end,
        id: dao.id,
    };
}

export class MongoAccountMembershipRepositoryFactory extends MongoRepositoryFactory<IAccountMembershipDoc> {
    protected updateModel(): void {
        const schema = getAccountMembershipsSchema(this.collection.name);
        schema.index({ accountId: 1, start: 1 }, { unique: true });
        this.model = this.collection.connection.model<IAccountMembershipDoc>("AccountMembershipDAO", schema);
    }

    build(logger: Logger): MongoAccountMembershipRepository {
        return new MongoAccountMembershipRepository(this.model, this.collection, logger);
    }
}

export class MongoAccountMembershipRepository extends MongoRepository<IAccountMembershipDoc> implements AccountMembershipRepository {

    async updateMemberCount(accountId: string, memberCount: number, manualToMemberCount: number): Promise<void> {
        const prevAccountMembershipDaos = await this.findEntities({ accountId }, { orderByField: "start", sortOrder: "descending", limit: 1 });
        const [ prevAccountMembership ] = prevAccountMembershipDaos.map(dao => accountMembershipDaoToModel(dao))
        if (prevAccountMembership?.memberCount === memberCount && prevAccountMembership?.manualToMemberCount === manualToMemberCount) {
            return;
        }

        const now = new Date();
        const sixHoursAgo = subHours(now, 6);
        const makeNewEntry = !prevAccountMembership || isBefore(prevAccountMembership.start, sixHoursAgo);
        const start = makeNewEntry ? now : prevAccountMembership.start;
        await this.saveEntity({ accountId, start }, <IAccountMembershipDoc>{
            accountId,
            memberCount,
            manualToMemberCount,
            start,
        });

        if (makeNewEntry && prevAccountMembership) {
            await this.saveEntity({ _id: prevAccountMembership.id }, <IAccountMembershipDoc>{
                accountId,
                end: now,
            });
        }
    }
    async findForAccount(accountId: string): Promise<AccountMembership[]> {
        const daos = await this.findEntities({ accountId });
        return daos.map(dao => accountMembershipDaoToModel(dao));
    }

    async deleteAccountMembership(accountId: string): Promise<void> {
        await this.deleteEntity({ accountId });
    }
}
