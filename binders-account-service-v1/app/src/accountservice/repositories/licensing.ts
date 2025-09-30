import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { AccountLicensing } from "../model"
import { Logger } from "@binders/binders-service-common/lib/util/logging"
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema"

function getLicensingSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema({
        accountId: {
            type: String,
            require: true
        },
        totalLicenses: Number,
        maxNumberOfLicenses: Number,
        totalPublicDocuments: Number,
        maxPublicCount: Number,
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

export interface AccountLicensingRepository {
    saveLicensing(licensing: AccountLicensing): Promise<AccountLicensing>;
    updateLicensing(licensing: AccountLicensing): Promise<AccountLicensing>;
    findLicensingForAccounts(accountIds: string[]): Promise<AccountLicensing[]>;
    findExceedingLimitsLicensing(): Promise<AccountLicensing[]>;
    deleteLicensing(accountId: string): Promise<void>;
}

export interface IAccountLicensing extends mongoose.Document {
    accountId: string;
    totalPublicDocuments: number;
    totalLicenses: number;
    maxNumberOfLicenses: number;
    maxPublicCount: number;
}

function licensingDaoToModel(dao: IAccountLicensing): AccountLicensing {
    return new AccountLicensing(
        dao.accountId,
        dao.totalPublicDocuments,
        dao.maxPublicCount,
        dao.totalLicenses,
        dao.maxNumberOfLicenses,
    );
}

export class MongoLicensingRepository extends MongoRepository<IAccountLicensing> implements AccountLicensingRepository {
    async saveLicensing(licensing: AccountLicensing): Promise<AccountLicensing> {
        const licensingDao = await this.saveEntity(
            {
                "accountId": licensing.accountId,
            },
            <IAccountLicensing>licensing
        );
        return licensingDaoToModel(licensingDao);
    }

    async updateLicensing(licensing: AccountLicensing): Promise<AccountLicensing> {
        await this.update(
            {
                "accountId": licensing.accountId,
            },
            <IAccountLicensing>licensing
        );
        return licensing;
    }

    async findLicensingForAccounts(accountIds: string[]): Promise<AccountLicensing[]> {
        const daos: IAccountLicensing[] = await this.findEntities({
            accountId: mongoose.trusted({
                $in: accountIds.map(String),
            }),
        });
        return daos.map(dao => licensingDaoToModel(dao));
    }

    async findExceedingLimitsLicensing(): Promise<AccountLicensing[]> {
        const daos: IAccountLicensing[] = await this.findEntities({
            $or: [
                {
                    $and: [
                        { "maxPublicCount": { $ne: null } },
                        { $expr: { $gt: ["$totalPublicDocuments", "$maxPublicCount"] } },
                    ]
                },
                { $expr: { $gt: ["$totalLicenses", "$maxNumberOfLicenses"] } },
            ]
        }, undefined, false);
        return daos.map(dao => licensingDaoToModel(dao));
    }

    async deleteLicensing(accountId: string): Promise<void> {
        await this.deleteEntity({ accountId });
    }

}

export class MongoLicensingRepositoryFactory extends MongoRepositoryFactory<IAccountLicensing> {
    build(logger: Logger): MongoLicensingRepository {
        return new MongoLicensingRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getLicensingSchema(this.collection.name);
        this.model = this.collection.connection.model<IAccountLicensing>("AccountLicensingDAO", schema);
    }
}
