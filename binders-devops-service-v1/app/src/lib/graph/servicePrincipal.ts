import { ClientSecretCredential } from "@azure/identity";
import { GraphApiClient } from "@binders/binders-service-common/lib/graph/graphApiClient";
import { ServicePrincipal } from "@microsoft/microsoft-graph-types";


export class ServicePrincipalClient extends GraphApiClient {
    constructor(credential: ClientSecretCredential) {
        super(credential)
    }    

    async getServicePrincipal(displayName: string): Promise<ServicePrincipal> {
        const request = await this.client.api("/servicePrincipals")
            .header("ConsistencyLevel", "eventual")
            .filter(`startswith(displayName,'${displayName}')`)
            .top(1)
            .get()

        if (request?.value && request.value.length > 0) {
            return request.value[0]
        }

        return null
    }
}