import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { ITermsAcceptanceEntry } from "@binders/client/lib/clients/userservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";
import { pick } from "ramda";
export interface TermsAcceptanceRepository {
    saveTermsAcceptance(userId: UserIdentifier, accountId: string, acceptedTermsVersion: string): Promise<void>;
    getTermsAcceptancesForUser(userId: UserIdentifier): Promise<TermsAcceptanceEntry[]>;
    addAccountIdToAll(accountId: string): Promise<number>;
}

export interface TermsAcceptanceDocument extends mongoose.Document, ITermsAcceptanceEntry {
    userId: string;
}

type TermsAcceptanceEntry = ITermsAcceptanceEntry<UserIdentifier>;

function daoToModel(dao: ITermsAcceptanceEntry): TermsAcceptanceEntry {
    return {
        ...pick(["acceptedTermsVersion", "accountId"], dao),
        userId: new UserIdentifier(dao.userId),
    };
}

function modelToDao(model: TermsAcceptanceEntry): ITermsAcceptanceEntry {
    return {
        ...pick(["acceptedTermsVersion", "accountId"], model),
        userId: model.userId.value(),
    }
}

function getTermsAcceptanceSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        userId: {
            type: String,
            require: true
        },
        accountId: {
            type: String,
            // require: true // enable after "april 22" release
        },
        acceptedTermsVersion: {
            type: String,
            require: true
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

export class MongoTermsAcceptanceRepositoryFactory extends MongoRepositoryFactory<TermsAcceptanceDocument> {

    build(logger: Logger): MongoTermsAcceptanceRepository {
        return new MongoTermsAcceptanceRepository(this.model, this.collection, logger);
    }

    updateModel(): void {
        const schema = getTermsAcceptanceSchema(this.collection.name);
        schema.index({ userId: 1, accountId: 1 }, { unique: true });
        this.model = this.collection.connection.model<TermsAcceptanceDocument>("TermsAcceptance", schema);
        this.model.syncIndexes();
    }
}

export class MongoTermsAcceptanceRepository extends MongoRepository<TermsAcceptanceDocument> implements TermsAcceptanceRepository {

    async saveTermsAcceptance(userId: UserIdentifier, accountId: string, acceptedTermsVersion: string): Promise<void> {
        await this.upsert(
            { userId: userId.value(), accountId },
            modelToDao({
                userId,
                accountId,
                acceptedTermsVersion
            }) as TermsAcceptanceDocument
        );
    }

    async getTermsAcceptancesForUser(userId: UserIdentifier): Promise<TermsAcceptanceEntry[]> {
        const termsAcceptanceEntries = await this.findEntities({ userId: userId.value() }, { limit: 9999 });
        return termsAcceptanceEntries.map(ta => daoToModel(ta));
    }

    addAccountIdToAll(accountId: string): Promise<number> {
        return this.update({}, { $set: { accountId } }, { multi: true }).then(result => result.updateCount);
    }

    setVersionInAll(acceptedTermsVersion: string): Promise<number> {
        return this.update({}, { $set: { acceptedTermsVersion } }, { multi: true }).then(result => result.updateCount);
    }

}