/* eslint-disable no-console */
import { AccountServiceContract, ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { main } from "@binders/binders-service-common/lib/util/process";

const config = BindersConfig.get();

const getClients = async () => {
    const scriptName = "seed-script-staging";
    const userClient = await BackendUserServiceClient.fromConfig(config, scriptName);
    const accountClient = await BackendAccountServiceClient.fromConfig(config, scriptName);
    const credentialClient = await BackendCredentialServiceClient.fromConfig(config, scriptName);
    const authorizationClient = await BackendAuthorizationServiceClient.fromConfig(config, scriptName);
    const routingClient = await BackendRoutingServiceClient.fromConfig(config, scriptName);
    return {
        accountClient,
        authorizationClient,
        credentialClient,
        routingClient,
        userClient,
    };
};

const STAGING_ACCOUNT = {
    name: "Staging",
    id: "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6",
    subscriptionType: "standard",
    expirationDate: "2080-09-01",
    maxNumberOfLicenses: 200,
    maxPublicDocs: 100
};
const STAGING_USERS = [
    {
        email: "admin@manual.to",
        displayName: "Staging Admin",
        password: "nothanks"
    }
];


const createAccount = async (accountClient, routingServiceClient) => {
    const account = await accountClient.createAccount(
        STAGING_ACCOUNT.name,
        STAGING_ACCOUNT.subscriptionType,
        STAGING_ACCOUNT.expirationDate,
        STAGING_ACCOUNT.expirationDate,
        STAGING_ACCOUNT.maxNumberOfLicenses,
        STAGING_ACCOUNT.maxPublicDocs,
        undefined,
        STAGING_ACCOUNT.id
    );
    const domain = process.argv[2];
    return routingServiceClient.setDomainsForAccount(account.id, [domain]);
};

const createUsers = (userClient, credentialClient, accountClient, authorizationClient) => {
    return STAGING_USERS.reduce(async (reduced, userData) => {
        await reduced;
        const user = await userClient.createUser(userData.email, userData.displayName);
        await credentialClient.createCredential(user.id, userData.email, userData.password);
        await accountClient.addMember(STAGING_ACCOUNT.id, user.id, ManageMemberTrigger.SCRIPT);
        await authorizationClient.addAccountAdmin(STAGING_ACCOUNT.id, user.id);
    }, Promise.resolve());
};

const checkAccount = async (accountClient: AccountServiceContract) => {
    const accounts = await accountClient.listAccounts();
    return !!accounts.find(acc => acc.id === STAGING_ACCOUNT.id);
};

main(async () => {
    const { accountClient, authorizationClient, credentialClient, routingClient, userClient } = await getClients();
    const accountExists = await checkAccount(accountClient);
    if (accountExists) {
        console.log("Account exists", accountExists)
        return;
    }
    try {
        await createAccount(accountClient, routingClient);
        await createUsers(userClient, credentialClient, accountClient, authorizationClient);

    } catch (error) {
        console.log("error", error)
    }
});