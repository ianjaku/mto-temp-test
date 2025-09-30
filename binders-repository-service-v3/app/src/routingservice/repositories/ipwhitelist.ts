import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { IPWhitelist } from "@binders/client/lib/clients/routingservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface IIPWhitelist extends mongoose.Document {
    domain: string;
    cidrs: string;
}

function getIPWhitelistSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema({
        domain: {
            type: String,
            required: true
        },
        cidrs: {
            type: String,
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

export interface IPWhitelistRepository {
    save(whitelist: IPWhitelist): Promise<void>;
    get(domain: string): Promise<IPWhitelist>;
}

const modelToDao = (model: IPWhitelist) => {
    return {
        domain: model.domain,
        cidrs: JSON.stringify(model.CIDRs),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
}

const daoToModel = (dao: IIPWhitelist): IPWhitelist => {
    const CIDRs = JSON.parse(dao.cidrs) || [];
    return {
        domain: dao.domain,
        CIDRs,
        enabled: CIDRs.length > 0
    };
}

export class MongoIPWhitelistRepository extends MongoRepository<IIPWhitelist> implements IPWhitelistRepository {
    async save(whitelist: IPWhitelist): Promise<void> {
        if (whitelist.enabled) {
            await this.saveEntity( { domain: whitelist.domain }, modelToDao(whitelist));
        } else {
            await this.deleteEntity( { domain: whitelist.domain } );
        }
    }
    async get(domain: string): Promise<IPWhitelist> {
        const entities = await this.findEntities( { domain } );
        if (entities.length === 1) {
            return daoToModel(entities[0]);
        }
        if (entities.length === 0) {
            return {
                domain,
                enabled: false,
                CIDRs: []
            }
        }
        throw new Error(`Multiple ipwhitelists for domain ${domain}`);
    }
}

export class IPWhitelistRepositoryFactory extends MongoRepositoryFactory<IIPWhitelist> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new MongoIPWhitelistRepository(this.model, this.collection, logger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    updateModel() {
        const schema = getIPWhitelistSchema(this.collection.name);
        schema.index({domain: 1}, {unique: true});
        this.model = this.collection.connection.model<IIPWhitelist> ("IPWhitelistDAO", schema);
    }

}