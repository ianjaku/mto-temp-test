/* eslint-disable no-console */
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { NodeClientHandler } from "@binders/binders-service-common/lib/apiclient/nodeclient";
import { buildBackendSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";

function getOptions() {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <ACCOUNT_ID> <USER_ID>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
        userId: process.argv[3]
    };
}

const options = getOptions();
const config = BindersConfig.get();

function getAZClient(): Promise<AuthorizationServiceClient> {
    return NodeClientHandler.forBackend(buildBackendSignConfig(config), "az-script")
        .then(handler => AuthorizationServiceClient.fromConfig(config, "v1", handler));
}

function addAccountAdmin(client: AuthorizationServiceClient, accountId: string, userId: string) {
    return client.addAccountAdmin(accountId, userId);
}

getAZClient()
    .then(azClient => addAccountAdmin(azClient, options.accountId, options.userId))
    .then(() => console.log("Successfully added account admin"))
    .catch(error => console.error("Could not add account admin", error));

// tslint:enable:no-console