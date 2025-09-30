/* eslint-disable no-console */
import {
    Account,
    AccountServiceContract
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract"

// tslint:disable:no-console
const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <ACCOUNTID>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2]
    };
};

const config = BindersConfig.get();
const options = getOptions();

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

function processUser(userServiceClient: UserServiceContract, userId: string) {
    return fetchUser(userServiceClient, userId)
        .then( user => {
            if (user !== undefined) {
                console.log( `${user.login},${!user.lastOnline ? 0 : 1}`);
            }
        });
}

function processAccount(userServiceClient: UserServiceContract, accountServiceClient: AccountServiceContract, account: Account) {
    return account.members.reduce( (reduced, userId) => {
        return reduced.then(
            () => processUser(userServiceClient, userId)
        );
    }, Promise.resolve(undefined));
}

Promise.all([
    BackendAccountServiceClient.fromConfig(config, "print-loggedin"),
    BackendUserServiceClient.fromConfig(config, "print-loggedin")
])
    .then( ([accountServiceClient, userServiceClient]) => {
        return accountServiceClient.getAccount(options.accountId)
            .then(account => processAccount(userServiceClient, accountServiceClient, account));
    });

// tslint:enable:no-console