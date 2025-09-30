import { ClientSecretCredential } from "@azure/identity"
import { Config } from "@binders/client/lib/config/config";


export function createClientSecretCredentialFromConfig(config: Config): ClientSecretCredential {
    const clientId = config.getString("azure.servicePrincipal.devops.login").get()
    const secret = config.getString("azure.servicePrincipal.devops.password").get()
    const tenantId = config.getString("azure.subscription.tenantId").get()
    
    if (!clientId) {
        throw new Error("Missing clientId/login in binders config")
    }
    if (!secret) {
        throw new Error("Missing secret/password in binders config")
    }
    if (!tenantId) {
        throw new Error("Missing tenantId in binders config")
    }

    return new ClientSecretCredential(tenantId, clientId, secret)
}

export function createClientSecretCredential(clientId: string, secret: string, tenantId: string): ClientSecretCredential {
    return new ClientSecretCredential(tenantId, clientId, secret)
}