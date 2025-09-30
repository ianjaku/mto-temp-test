import * as clientContract from "@binders/client/lib/clients/userservice/v1/contract";
import * as mongoose from "mongoose";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { User } from "../models/user";
import { UserImportAction } from "../models/userimportaction";
import { UserImportActionQuery } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserImportResult } from "../models/userimportresult";

export interface UserImportActionRepository {
    listUserImportActions(accountId: string): Promise<Array<UserImportAction>>;
    insertUserImportAction(userImportAction: UserImportAction): Promise<UserImportAction>;
    findUserImportActions(query: UserImportActionQuery): Promise<Array<UserImportAction>>;
}

export interface IUserImportAction extends mongoose.Document {
    accountId: string;
    importDate: string;
    userImportResults: string;
}

function getLogin(user: clientContract.User | User | clientContract.CevaUser): string {
    if (clientContract.isCevaUser(user)) {
        return user.employeeId;
    } else if (user instanceof User) {
        return user.login?.value();
    }
    return (user as clientContract.User).login;
}

function getDisplayName(user) {
    if (clientContract.isCevaUser(user)) {
        return `${user.firstName} ${user.lastName}`;
    } else {
        return user.displayName;
    }
}

export function toModelUserImportResult(userImportResult: clientContract.UserImportResult): UserImportResult {
    const { user, exception, invitationLink, invitationLinkSentDate } = userImportResult;
    const userId = user.id;
    const firstName = user.firstName;
    const lastName = user.lastName;
    const login = getLogin(user);
    const displayName = getDisplayName(user);
    const lastOnline = user.lastOnline;
    return new UserImportResult(
        userId?.key || userId,
        login,
        displayName,
        exception,
        invitationLink,
        invitationLinkSentDate,
        firstName,
        lastName,
        lastOnline,
        user.tags
    );
}


function userImportActionDaoToModel(userImportAction: IUserImportAction): UserImportAction {
    return new UserImportAction(userImportAction.accountId, userImportAction.importDate, JSON.parse(userImportAction.userImportResults));
}

function userImportActionModelToDao(userImportAction: UserImportAction): IUserImportAction {
    return <IUserImportAction> {
        accountId: userImportAction.accountId,
        importDate: userImportAction.importDate,
        userImportResults: JSON.stringify(userImportAction.userImportResults)
    };
}

function getUserImportActionSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema({
        accountId: {
            type: String,
            required: true
        },
        importDate: {
            type: Date,
            required: true
        },
        userImportResults: {
            type: String,
            required: false
        }
    }, { collection: collectionName } );
}

export class MongoUserImportActionRepositoryFactory extends MongoRepositoryFactory<IUserImportAction> {
    protected updateModel(): void {
        const schema = getUserImportActionSchema(this.collection.name);
        this.model = this.collection.connection.model<IUserImportAction> ("UserImportActionDAO", schema);
    }
    build(logger: Logger): MongoUserImportActionRepository {
        return new MongoUserImportActionRepository(this.model, this.collection, logger);
    }
}

export class MongoUserImportActionRepository extends MongoRepository<IUserImportAction> implements UserImportActionRepository {
    listUserImportActions(accountId: string): Promise<Array<UserImportAction>> {
        return this.findEntities({accountId: accountId}, {orderByField: "importDate", sortOrder: "descending"}).
            then(daos => daos.map(userImportActionDaoToModel));
    }
    insertUserImportAction(userImportAction: UserImportAction): Promise<UserImportAction> {
        return this.insertEntity( userImportActionModelToDao(userImportAction))
            .then(storedResult => userImportActionDaoToModel(storedResult));
    }
    findUserImportActions(query: UserImportActionQuery): Promise<Array<UserImportAction>> {
        return this.findEntities(query)
            .then(daos => daos.map(userImportActionDaoToModel));
    }
    saveUserImportAction(userImportAction: UserImportAction): Promise<UserImportAction> {
        const dao = userImportActionModelToDao(userImportAction);
        return this.saveEntity({ importDate: dao.importDate }, dao).then(userImportActionDaoToModel);
    }
}
