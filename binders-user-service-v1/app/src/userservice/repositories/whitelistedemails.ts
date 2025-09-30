import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { IWhitelistedEmailFilter } from "@binders/client/lib/clients/userservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { WhitelistedEmail } from "../models/whitelistedemail";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface WhitelistedEmailRepository {
    insertWhitelistedEmail(whitelistedEmail: WhitelistedEmail): Promise<WhitelistedEmail>;
    listWhitelistedEmails(accountId: string, filter?: IWhitelistedEmailFilter): Promise<Array<WhitelistedEmail>>;
    isEmailWhitelisted(accountId: string, domain: string, email: string): Promise<boolean>;
    setWhitelistedEmailActive(id: string, active: boolean): Promise<void>;
    getWhitelistedEmailById(id: string): Promise<WhitelistedEmail>;
}

export interface IWhitelistedEmail extends mongoose.Document {
    accountId: string;
    domain: string;
    pattern: string;
    active: boolean;
}

function whitelistedEmailDaoToModel(whitelistedEmail: IWhitelistedEmail): WhitelistedEmail {
    return new WhitelistedEmail(whitelistedEmail.id, whitelistedEmail.accountId, whitelistedEmail.domain, whitelistedEmail.pattern, whitelistedEmail.active);
}

function whitelistedEmailModelToDao(whitelistedEmail: WhitelistedEmail): IWhitelistedEmail {
    return <IWhitelistedEmail>{
        accountId: whitelistedEmail.accountId,
        domain: whitelistedEmail.domain,
        pattern: whitelistedEmail.pattern,
        active: whitelistedEmail.active
    };
}

function getWhitelistedEmailSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema({
        accountId: {
            type: String,
            required: true
        },
        domain: {
            type: String,
            required: true
        },
        pattern: {
            type: String,
            required: true
        },
        active: {
            type: Boolean,
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
    }, { collection: collectionName } );
    return addTimestampMiddleware(schema, "updated");
}

export class MongoWhitelistedEmailRepositoryFactory extends MongoRepositoryFactory<IWhitelistedEmail> {
    protected updateModel(): void {
        const schema = getWhitelistedEmailSchema(this.collection.name);
        this.model = this.collection.connection.model<IWhitelistedEmail> ("WhitelistedEmailDAO", schema);
    }
    build(logger: Logger): MongoWhitelistedEmailRepository {
        return new MongoWhitelistedEmailRepository(this.model, this.collection, logger);
    }
}

export class MongoWhitelistedEmailRepository extends MongoRepository<IWhitelistedEmail> implements WhitelistedEmailRepository {
    insertWhitelistedEmail(whitelistedEmail: WhitelistedEmail): Promise<WhitelistedEmail> {
        return this.insertEntity( whitelistedEmailModelToDao(whitelistedEmail))
            .then(storedResult => whitelistedEmailDaoToModel(storedResult));
    }
    async listWhitelistedEmails(accountId: string, filter: IWhitelistedEmailFilter): Promise<Array<WhitelistedEmail>> {
        const daos = await this.findEntities({
            accountId,
            ...( filter && filter.isActive !== undefined ? { active: filter.isActive } : {} )
        });
        return daos.map(whitelistedEmailDaoToModel);
    }
    isEmailWhitelisted(accountId: string, domain: string, email: string): Promise<boolean> {
        return this.findEntities({accountId, domain, active: true})
            .then(daos => daos.map(whitelistedEmailDaoToModel))
            .then(whitelistedEmails => {
                for (const whitelistedEmail of whitelistedEmails) {
                    if (new RegExp(`^${whitelistedEmail.pattern.replace(/\*/g, ".*")}`).test(email)) {
                        return true;
                    }
                }
                return false;
            });
    }
    setWhitelistedEmailActive(id: string, active: boolean): Promise<void> {
        return this.update({ _id: id}, {active})
            .then(() => undefined);
    }

    async getWhitelistedEmailById(id: string): Promise<WhitelistedEmail> {
        const maybeWhitelistedEmail = await this.fetchOne({ _id: id });
        return maybeWhitelistedEmail.isJust() ? whitelistedEmailDaoToModel(maybeWhitelistedEmail.get()) : undefined;
    }
}
