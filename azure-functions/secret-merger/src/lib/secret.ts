import { KeyVaultSecret, SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";
import { InvocationContext } from "@azure/functions";

export function createSecretClient(keyVaultName: string): SecretClient {
    const KVUri = "https://" + keyVaultName + ".vault.azure.net";
    const credential = new DefaultAzureCredential();
    return new SecretClient(KVUri, credential);
}


export async function updateSecret(client: SecretClient, name: string, value: Record<string, unknown>): Promise<KeyVaultSecret> {
    return client.setSecret(name, JSON.stringify(value))
}

export async function getSecret(ctx: InvocationContext, client: SecretClient, name: string): Promise<KeyVaultSecret> {
    try {
        return await client.getSecret(name)
    } catch (error) {
        ctx.log(error)
        return null;
    }
}

export async function deleteSecret(client: SecretClient, secretName: string) {
    await client.beginDeleteSecret(secretName)
}

export function getSecretNameFromBranch(branchName: string): string {
    return branchName.substr(0, 16).replace(/\//g, "-").replace(/(^-+)|(-+$)/g, "").toLowerCase();
}
