import { Client, ClientOptions } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import {
    TokenCredentialAuthenticationProvider
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import "isomorphic-fetch";

/**
 * @deprecated Use {@link MicrosoftGraphApiClient} instead
 */
export abstract class GraphApiClient {
    client: Client;
    constructor(credential: ClientSecretCredential) {
        const authProvider = new TokenCredentialAuthenticationProvider(credential, { scopes: ["https://graph.microsoft.com/.default"] });
        const clientOptions: ClientOptions = {
            defaultVersion: "v1.0",
            debugLogging: false,
            authProvider
        };
        this.client = Client.initWithMiddleware(clientOptions);
    }

}

