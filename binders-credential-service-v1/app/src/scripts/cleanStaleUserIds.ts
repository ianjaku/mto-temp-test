/* eslint-disable no-console */
import * as mongoose from "mongoose";
import { Account, AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BackendAccountServiceClient, BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { MongoCredentialRepository, MongoCredentialRepositoryFactory } from "./../credentialservice/repositories/credentials";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Login } from "@binders/binders-service-common/lib/authentication/identity";
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";

const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <ACCOUNTID> <DO_DELETE>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
        doDelete: process.argv[3] === "1",
    };
};

const config = BindersConfig.get();
const options = getOptions();
const topLevelLogger = LoggerBuilder.fromConfig(config);
let deleted = 0;
let kept = 0;
let total = 0;

function fetchUser(userServiceClient: UserServiceContract, userId: string) {
    return userServiceClient.getUser(userId)
        .then(
            user => user,
            error => {
                if (error.statusCode === 404) {
                    return undefined;
                }
                throw error;
            }
        );
}

function removeUserCredentials(credentialRepository: MongoCredentialRepository, userId: string): Promise<void> {
    if (options.doDelete) {
        console.log("Deleting credential for user", userId);
        return credentialRepository.deleteCredentialByUserId(userId);
    }
    else {
        console.log("(DryRun) Deleting credential for user", userId);
        return Promise.resolve(undefined);
    }
}

function validateCredential(credentialReposistory: MongoCredentialRepository, userId: string, login: string) {
    function keep() {
        kept++;
        console.log("Keeping credentials for user", userId);
    }
    function drop(uid: string) {
        deleted++;
        console.log("User id mismatch for " + login);
        return removeUserCredentials(credentialReposistory, uid);
    }
    return credentialReposistory.getLoginAndPassword(new Login(login))
        .then(
            loginAndPass => {
                const storedUserId = loginAndPass.userId.value();
                return storedUserId === userId ?
                    keep() :
                    drop(storedUserId);
            },
            () => keep()
        );
}

function processUser(userServiceClient: UserServiceContract, credentialRepository: MongoCredentialRepository, userId: string) {
    return fetchUser(userServiceClient, userId)
        .then( user => {
            if (user === undefined) {
                deleted++;
                console.log("User", userId, "not found");
                return removeUserCredentials(credentialRepository, userId);
            }
            return validateCredential(credentialRepository, userId, user.login);
        });
}

function processAccount(userServiceClient: UserServiceContract, accountServiceClient: AccountServiceContract,
    credentialRepository: MongoCredentialRepository, account: Account) {
    total = account.members.length;
    console.log(`Found ${total} account members.`);
    return account.members.reduce( (reduced, userId) => {
        return reduced.then(
            () => processUser(userServiceClient, credentialRepository, userId)
        );
    }, Promise.resolve(undefined));
}

const loginOption = getMongoLogin("credential_service");

Promise.all([
    BackendAccountServiceClient.fromConfig(config, "print-loggedin"),
    BackendUserServiceClient.fromConfig(config, "print-loggedin"),
    CollectionConfig.promiseFromConfig(config, "credentials", loginOption)
])
    .then( ([accountServiceClient, userServiceClient, credentialCollectionConfig]) => {
        const repoFactory = new MongoCredentialRepositoryFactory(credentialCollectionConfig, topLevelLogger);
        const repo = repoFactory.build(topLevelLogger);
        return accountServiceClient.getAccount(options.accountId)
            .then(account => processAccount(userServiceClient, accountServiceClient, repo, account))
            .then(() => mongoose.disconnect(), () => mongoose.disconnect())
            .then(() => {
                console.log(`Deleted ${deleted} / ${total}`);
                console.log(`Kept ${kept} / ${total}`);
            });
    });

// tslint:enable:no-console
