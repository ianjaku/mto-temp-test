import * as mongoose from "mongoose";
import { Account, AccountIdentifier, IAccountStorageDetails, SubscriptionTypes } from "../model";
import {
    AccountNotFound,
    IAccountFilter
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { InvalidatorManager } from "@binders/binders-service-common/lib/cache/invalidating/invalidators"
import { Logger } from "@binders/binders-service-common/lib/util/logging"
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity"
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema"

export interface AccountRepository {
    saveAccount(account: Account): Promise<Account>;
    deleteAccount(accountId: AccountIdentifier, isHardDelete?: boolean): Promise<AccountIdentifier | void>;
    restoreAccount(accountId: AccountIdentifier): Promise<AccountIdentifier>;
    listAccounts(): Promise<Account[]>;
    getAccount(accountId: AccountIdentifier): Promise<Account>;
    findAccountIdsForUser(userId: string): Promise<string[]>;
    findAccountIdsForUsers(userIds: string[]): Promise<Record<string, string[]>>;
    findAccountsForUser(userId: string): Promise<Account[]>;
    findAccountsForIds(accountIds: string[]): Promise<Array<Account>>;
    findAccounts(filter: IAccountFilter): Promise<Array<Account>>;
    // eslint-disable-next-line @typescript-eslint/ban-types
    findRawAccounts(): Promise<Object[]>;
}

export interface IAccount extends mongoose.Document {
    accountId: string;
    name: string;
    members: string[];
    subscriptionType: string;
    subscriptionId: string;
    expirationDate: Date;
    readerExpirationDate?: Date;
    created: Date;
    storageDetails: IStorageDetails;
    isAnonymised: boolean;
}

export interface IStorageDetails extends mongoose.Document {
    deletedVisualsSize: number;
    dirty: boolean;
    inUseVisualsSize: number;
}

function getEmptyStorageDetails(): IAccountStorageDetails {
    return {
        deletedVisualsSize: 0,
        dirty: false,
        inUseVisualsSize: 0
    }
}

function getStorageDetails(account: IAccount): IAccountStorageDetails {
    if (account.storageDetails) {
        const { inUseVisualsSize, dirty, deletedVisualsSize } = account.storageDetails
        return {
            inUseVisualsSize,
            dirty,
            deletedVisualsSize
        }
    }
    else {
        return account.storageDetails
    }

}

function accountDaoToModel(account: IAccount): Account {
    const accountId = new AccountIdentifier(account.accountId);
    const mappedMembers = account.members.map(member => new UserIdentifier(member));
    const subscriptionType = SubscriptionTypes.toEnumUnsafe(account.subscriptionType);
    const storageDetails = getStorageDetails(account)
    return new Account(
        accountId,
        account.name,
        mappedMembers,
        subscriptionType,
        account.subscriptionId,
        account.created,
        account.expirationDate,
        account.readerExpirationDate,
        false,
        false,
        [],
        undefined,
        undefined,
        storageDetails,
        account.isAnonymised
    );
}

function accountModelToDao(account: Account) {
    const storageDetails = account.storageDetails ? account.storageDetails : getEmptyStorageDetails()
    return {
        accountId: account.id.value(),
        name: account.name,
        members: account.members.map(member => member.value()),
        subscriptionType: SubscriptionTypes.toStringUnsafe(account.subscriptionType),
        subscriptionId: account.subscriptionId,
        expirationDate: account.expirationDate,
        readerExpirationDate: account.readerExpirationDate,
        storageDetails,
        isAnonymised: account.isAnonymised
    };
}

const StorageDetailsSchema = new mongoose.Schema({
    deletedVisualsSize: {
        type: Number,
        required: true
    },
    dirty: {
        type: Boolean,
        required: true
    },
    inUseVisualsSize: {
        type: Number,
        required: true
    }
});

function getAccountSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema({
        accountId: {
            type: String,
            require: true,
            unique: true
        },
        name: {
            type: String,
            require: true,
            unique: true,
        },
        members: {
            type: [String],
            require: true
        },
        subscriptionType: {
            type: String,
            require: true
        },
        subscriptionId: String,
        expirationDate: {
            type: Date,
            require: true
        },
        readerExpirationDate: Date,
        deleted: Boolean,
        created: {
            type: Date,
            default: Date.now
        },
        updated: {
            type: Date,
            default: Date.now
        },
        storageDetails: {
            type: StorageDetailsSchema
        },
        isAnonymised: {
            type: Boolean
        }
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export class MongoAccountRepository extends MongoRepository<IAccount> implements AccountRepository {

    private invalidator = new InvalidatorManager();

    findRawAccounts(): Promise<IAccount[]> {
        return this.findEntities({});
    }

    saveAccount(account: Account): Promise<Account> {
        const dao = accountModelToDao(account);
        return this.saveEntity({ accountId: dao.accountId }, <IAccount>dao).then(accountDaoToModel);
    }

    private updateDeleteFlag(accountId: AccountIdentifier, deleteFlag: boolean) {
        return this.update({ accountId: accountId.value() }, { deleted: deleteFlag }).then(
            () => accountId
        );
    }

    async deleteAccount(accountId: AccountIdentifier, isHardDelete = false): Promise<AccountIdentifier | void> {
        await this.invalidator.onDelete([{
            name: "account",
            accountId: accountId.value()
        }]);
        if (isHardDelete) {
            if (!accountId) {
                return;
            }
            await this.deleteEntity({ accountId: accountId.value() });
            return accountId;
        }
        const result = await this.updateDeleteFlag(accountId, true);
        return result;
    }

    restoreAccount(accountId: AccountIdentifier): Promise<AccountIdentifier> {
        return this.updateDeleteFlag(accountId, false);
    }

    listAccounts(): Promise<Account[]> {
        return this.findEntities({}).then(daos => daos.map(accountDaoToModel));
    }

    async getAccount(accountId: AccountIdentifier): Promise<Account> {
        return this.fetchOne({
            accountId: accountId.value(),
            deleted: mongoose.trusted({ $ne: true })
        }).then((accountDaoOption) => {
            if (accountDaoOption.isJust()) {
                return accountDaoToModel(accountDaoOption.get());
            } else {
                throw new AccountNotFound(accountId.value());
            }
        });
    }

    async findAccountIdsForUser(userId: string): Promise<string[]> {
        const accountIdObjects: { accountId: string }[] = await this.findEntities(
            { members: userId },
            { select: "accountId" }
        );
        return accountIdObjects.map(accountId => accountId.accountId);
    }

    async findAccountIdsForUsers(userIds: string[]): Promise<Record<string, string[]>> {
        const accountObjects: { accountId: string, members: string[] }[] = await this.findEntities(
            { $or: userIds.map(userId => ({ members: userId })) },
        );
        return userIds.reduce((acc, userId) => {
            const accountIds = accountObjects.filter(account => account.members.includes(userId)).map(account => account.accountId);
            return {
                ...acc,
                [userId]: accountIds,
            }
        }, {} as Record<string, string[]>);
    }

    findAccountsForUser(userId: string): Promise<Account[]> {
        return this.findEntities({ members: userId })
            .then(daos => daos.map(accountDaoToModel));
    }

    async findAccounts(filter: IAccountFilter): Promise<Account[]> {
        const { name } = filter;
        const daos = await this.findEntities({ ...(name ? { name } : {}) });
        return daos.map(accountDaoToModel);
    }

    async findAccountsForIds(accountIds: string[]): Promise<Array<Account>> {
        const daos = await this.findEntities({
            accountId: mongoose.trusted({ $in: accountIds.map(String) })
        });
        return daos.map(accountDaoToModel);
    }
}

export class MongoAccountRepositoryFactory extends MongoRepositoryFactory<IAccount> {

    build(logger: Logger): MongoAccountRepository {
        return new MongoAccountRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getAccountSchema(this.collection.name);
        schema.index({
            members: -1
        });
        this.model = this.collection.connection.model<IAccount>("AccountDAO", schema);
    }

}
