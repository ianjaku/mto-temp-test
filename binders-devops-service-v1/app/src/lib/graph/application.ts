import { Application, PasswordCredential } from "@microsoft/microsoft-graph-types";
import { ClientSecretCredential } from "@azure/identity";
import { GraphApiClient } from "@binders/binders-service-common/lib/graph/graphApiClient";

const DEFAULT_DISPLAY_NAME = "Password generated automatically"

export class ApplicationClient extends GraphApiClient {
    constructor(credential: ClientSecretCredential) {
        super(credential)
    }

    async createPassword(appId: string, displayName = DEFAULT_DISPLAY_NAME): Promise<PasswordCredential> {
        const passwordCredential = {
            passwordCredential: {
                displayName
            }
        };

        return this.client.api(`/applications/${appId}/addPassword`)
            .post(passwordCredential);
    }

    async getApplication(appId: string): Promise<Application> {
        return this.client.api(`/applications/${appId}`)
            .get();
    }

    async listApplications(): Promise<{ value: Application[]}> {
        return this.client.api("/applications").get()
    }


}