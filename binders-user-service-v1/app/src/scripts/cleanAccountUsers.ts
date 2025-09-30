/* eslint-disable no-console */
import {
    Account,
    AccountServiceContract,
    ManageMemberTrigger
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract"

// tslint:disable:no-console
const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <ACCOUNTID> <DO_DELETE>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
        doDelete: (process.argv[3] === "1")
    };
};

const config = BindersConfig.get();
const options = getOptions();

function userExists(userServiceClient: UserServiceContract, userId) {
    return userServiceClient.getUser(userId)
        .then(
            () => true,
            error => {
                if (error.statusCode === 404) {
                    return false;
                }
                throw error;
            }
        );
}

function removeMember(accountServiceClient: AccountServiceContract, accountId: string, userId: string) {
    return accountServiceClient.removeMember(accountId, userId, ManageMemberTrigger.SCRIPT);
}

function sanitizeUser(userServiceClient: UserServiceContract, accountServiceClient: AccountServiceContract, member: string, account: Account) {
    return userExists(userServiceClient, member)
        .then(exists => {
            if (exists) {
                console.log("Keeping user ", member);
                return Promise.resolve(undefined);
            }
            else {
                if (options.doDelete) {
                    console.log("Removing user ", member);
                    return removeMember(accountServiceClient, account.id, member);
                }
                else {
                    console.log("(Dry-run) Removing user", member);
                    return Promise.resolve(undefined);
                }
            }
        });
}

function cleanAccount(userServiceClient: UserServiceContract, accountServiceClient: AccountServiceContract, account: Account) {
    return account.members.reduce( (reduced, member) => {
        return reduced.then( () => sanitizeUser(userServiceClient, accountServiceClient, member, account) );
    }, Promise.resolve(undefined));
}

Promise.all([
    BackendAccountServiceClient.fromConfig(config, "clean-account-ids"),
    BackendUserServiceClient.fromConfig(config, "clean-account-ids")
])
    .then( ([accountServiceClient, userServiceClient]) => {
        return accountServiceClient.getAccount(options.accountId)
            .then(account => cleanAccount(userServiceClient, accountServiceClient, account));
    });

// tslint:enable:no-console