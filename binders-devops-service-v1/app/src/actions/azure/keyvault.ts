import { KeyVaultSecret, SecretClient } from "@azure/keyvault-secrets";
import { buildAndRunCommand, buildAzCommand } from "../../lib/commands";
import { BindersSecrets } from "../../lib/bindersconfig";
import { ClientSecretCredential } from "@azure/identity";
import { Env } from "../../lib/environment";
import log from "../../lib/logging";

export const ENV_NAME = {
    "dev": "dev",
    "staging": "stg",
    "production": "prod"
}

const parseKeyVaultUri = (keyVaultUri: string) => {
    const { host } = new URL(keyVaultUri)
    return host.split(".")[0]
}

export const DEFAULT_SECRET_NAME = "develop"

export async function setKeyVaultSecret(keyVaultUri: string, secretName: string, filepath: string): Promise<void> {
    const keyVaultName = parseKeyVaultUri(keyVaultUri)
    const args = ["keyvault", "secret", "set", "--vault-name", keyVaultName, "--name", secretName, "--file", filepath]
    await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
}

export async function getKeyVaultSecret(keyVaultUri: string, secretName: string): Promise<KeyVaultSecret> {
    const keyVaultName = parseKeyVaultUri(keyVaultUri)
    const args = ["keyvault", "secret", "show", "--vault-name", keyVaultName, "--name", secretName]
    const { output } = await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
    return JSON.parse(output) as KeyVaultSecret
}

export async function loadBindersSecrets(env: Env, secretName: string): Promise<BindersSecrets> {
    const keyVaultName = `binder${ENV_NAME[env]}bindersmedia`
    const args = ["keyvault", "secret", "show", "--vault-name", keyVaultName, "--name", secretName ? secretName : DEFAULT_SECRET_NAME]
    const { output } = await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
    const secret = JSON.parse(output) as KeyVaultSecret
    return JSON.parse(secret.value) as BindersSecrets
}


export function createSecretClient(credential: ClientSecretCredential, keyVaultName: string): SecretClient {
    const KVUri = "https://" + keyVaultName + ".vault.azure.net";
    return new SecretClient(KVUri, credential);
}

export async function getSecret(client: SecretClient, name: string): Promise<KeyVaultSecret> {
    try {
        return await client.getSecret(name)
    } catch (error) {
        log(error)
        return null;
    }
}

export async function setSecret<T>(client: SecretClient, name: string, value: T): Promise<KeyVaultSecret> {
    try {
        return await client.setSecret(name, JSON.stringify(value))
    } catch (error) {
        log(error)
        return null;
    }
}

export async function getAllSecretNames(client: SecretClient): Promise<string[]> {
    try {
        const result = []
        for await (const { name } of client.listPropertiesOfSecrets()) {
            result.push(name)
        }
        return result
    } catch (error) {
        log(error)
        return null;
    }
}