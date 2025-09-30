import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { DomainFilter } from "@binders/client/lib/clients/routingservice/v1/contract";
import { DomainFilterIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";
import { pick } from "ramda";

export interface IDomainFilter extends mongoose.Document {
    domainFilterId: string;
    accountId: string;
    domain: string;
    domainCollectionId: string;
}

function daoToModel(dao: unknown): DomainFilter {
    return pick([
        "domainFilterId",
        "accountId",
        "domain",
        "domainCollectionId",
    ], dao) as DomainFilter;
}

function getDomainFilterSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema({
        domainFilterId: {
            type: String,
            required: true
        },
        accountId: {
            type: String,
            required: true
        },
        domain: {
            type: String,
            required: true
        },
        domainCollectionId: {
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
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export interface DomainFilterRepository {
    setDomainsForAccount(accountId: string, domains: string[], domainCollectionId: string): Promise<DomainFilter[]>;
    getDomainFiltersForAccounts(accountIds: string[]): Promise<DomainFilter[]>;
    getDomainFilterByDomain(domain: string): Promise<DomainFilter>;
    listDomainFilters(): Promise<DomainFilter[]>;
    deleteDomainFilter(domain: string): Promise<void>;
}

export class MongoDomainFilterRepository extends MongoRepository<IDomainFilter> implements DomainFilterRepository {

    async setDomainsForAccount(accountId: string, domains: string[], domainCollectionId: string): Promise<DomainFilter[]> {

        const existingDomainFilters = await this.getDomainFiltersForAccounts([accountId]);
        const existingDomains = existingDomainFilters.map(domainFilter => domainFilter.domain);

        const toDelete = existingDomains.reduce((reduced, domain) => {
            if (!domains.find(d => d === domain)) {
                reduced.push(domain);
            }
            return reduced;
        }, []);
        const toAdd = domains.reduce((reduced, domain) => {
            if (!existingDomains.find(d => d === domain)) {
                reduced.push(domain);
            }
            return reduced;
        }, []);
        const insertDaos = toAdd.map(domain => {
            return {
                domainFilterId: DomainFilterIdentifier.generate().value(),
                accountId,
                domain,
                domainCollectionId
            } as IDomainFilter;
        });
        await this.insertMany(insertDaos);
        await this.deleteMany({ domain: mongoose.trusted({ $in: toDelete.map(String) }) });
        return this.getDomainFiltersForAccounts([accountId]);
    }

    getDomainFiltersForAccounts(accountIds: string[]): Promise<DomainFilter[]> {
        return this.findEntities({ accountId: mongoose.trusted({ $in: accountIds.map(String) }) })
            .then(daos => daos.map(dao => daoToModel(dao)));
    }

    async getDomainFilterByDomain(domain: string): Promise<DomainFilter> {
        const daos = await this.findEntities({ domain });
        return daos && daos.length > 0 ? daoToModel(daos[0]) : undefined;
    }

    async listDomainFilters(): Promise<DomainFilter[]> {
        const daos = await this.findEntities({});
        return daos ? daos.map(dao => daoToModel(dao)) : [];
    }
    async deleteDomainFilter(domain: string): Promise<void> {
        await this.deleteEntity({ domain });
    }
}

export class DomainFilterRepositoryFactory extends MongoRepositoryFactory<IDomainFilter> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new MongoDomainFilterRepository(this.model, this.collection, logger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    updateModel() {
        const schema = getDomainFilterSchema(this.collection.name);
        schema.index({ domain: 1 }, { unique: true });
        this.model = this.collection.connection.model<IDomainFilter>("DomainFilterDAO", schema);
    }

}
