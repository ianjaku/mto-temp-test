import * as mongoose from "mongoose";
import { AccountIdentifier, Customer, CustomerIdentifier } from "../model";
import {
    CustomerNotFound,
    ICustomersQuery
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging"
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema"

export interface CustomerRepository {
    saveCustomer(customer: Customer): Promise<Customer>;
    deleteCustomer(customerId: CustomerIdentifier): Promise<CustomerIdentifier>;
    restoreCustomer(customerId: CustomerIdentifier): Promise<CustomerIdentifier>;
    listCustomers(): Promise<Customer[]>;
    findCustomers(query: ICustomersQuery): Promise<Customer[]>;
    getCustomer(customerId: CustomerIdentifier): Promise<Customer>;
}

export interface ICustomer extends mongoose.Document {
    customerId: string;
    name: string;
    accountIds: string[];
    crmCustomerId: string;
    created: Date;
    updated: Date;
}

function customerDaoToModel(customer: ICustomer): Customer {
    const customerId = new CustomerIdentifier(customer.customerId);
    const mappedAccountIds = customer.accountIds.map(accountId => new AccountIdentifier(accountId));
    return new Customer(
        customerId,
        customer.name,
        mappedAccountIds,
        customer.crmCustomerId,
        customer.created,
    );
}

function customerModelToDao(customer: Customer) {
    return {
        customerId: customer.id.value(),
        name: customer.name,
        crmCustomerId: customer.crmCustomerId,
        accountIds: customer.accountIds.map(accountId => accountId.value()),
    };
}

function getCustomerSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema({
        customerId: {
            type: String,
            require: true
        },
        name: {
            type: String,
            require: true
        },
        accountIds: {
            type: [String],
            require: true
        },
        crmCustomerId: String,
        deleted: Boolean,
        created: {
            type: Date,
            default: Date.now
        },
        updated: {
            type: Date,
            default: Date.now
        },
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export class MongoCustomerRepository extends MongoRepository<ICustomer> implements CustomerRepository {

    async saveCustomer(customer: Customer): Promise<Customer> {
        const dao = customerModelToDao(customer);
        const savedCustomer = await this.saveEntity({ "customerId": dao.customerId }, <ICustomer>dao);
        return customerDaoToModel(savedCustomer);
    }

    private async updateDeleteFlag(customerId: CustomerIdentifier, deleteFlag: boolean) {
        await this.update({ "customerId": customerId.value() }, { "deleted": deleteFlag });
        return customerId;
    }

    deleteCustomer(customerId: CustomerIdentifier): Promise<CustomerIdentifier> {
        return this.updateDeleteFlag(customerId, true);
    }

    restoreCustomer(customerId: CustomerIdentifier): Promise<CustomerIdentifier> {
        return this.updateDeleteFlag(customerId, false);
    }

    async listCustomers(): Promise<Customer[]> {
        const daos = await this.findEntities({
            $or: [{ deleted: mongoose.trusted({ $exists: false }) }, { deleted: false }]
        });
        return daos.map(customerDaoToModel);
    }

    async findCustomers(query: ICustomersQuery): Promise<Customer[]> {
        const { accountId } = query;
        if (!accountId) {
            return [];
        }
        const daos = await this.findEntities({ accountIds: mongoose.trusted({ $elemMatch: { $eq: String(accountId) } }) });
        return daos.map(customerDaoToModel);
    }

    async getCustomer(customerId: CustomerIdentifier): Promise<Customer> {
        const customerDao = await this.fetchOne({
            "customerId": customerId.value(),
            "deleted": mongoose.trusted({ $ne: true })
        });
        if (customerDao.isJust()) {
            return customerDaoToModel(customerDao.get());
        } else {
            throw new CustomerNotFound(customerId.value());
        }
    }
}

export class MongoCustomerRepositoryFactory extends MongoRepositoryFactory<ICustomer> {

    build(logger: Logger): MongoCustomerRepository {
        return new MongoCustomerRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getCustomerSchema(this.collection.name);
        this.model = this.collection.connection.model<ICustomer>("CustomerDAO", schema);
    }
}
