import { BindersSecrets, LaunchDarklyConfig } from "./bindersconfig";
import {
    getKeyVaultSecret,
    loadBindersSecrets,
    setKeyVaultSecret
} from "../actions/azure/keyvault";
import { Env } from "./environment";
import { KeyVaultSecret } from "@azure/keyvault-secrets";
import { dirname } from "path";
import { dumpJSON } from "./json";
import { getKeyVaultUri } from "./terraform";
import { log } from "./logging";
import { realpathSync } from "fs";
import { shortenBranchName } from "./k8s";



const currentDir = realpathSync(dirname(__filename));
const DEFAULT_SECRET_NAME = "develop"


export function buildConfigFilePath(branchName: string, env: Env): string {
    const secretFilePrefix = getSecretNameFromBranch(branchName)
    return `${currentDir}/../config/${secretFilePrefix}.${env}.secrets.json`
}

function buildTerraformOutputsFilePath(env: Env): string {
    return `${currentDir}/../config/terraform-outputs/outputs.${env}.json`
}

export function getSecretNameFromBranch(branchName: string): string {
    return shortenBranchName(branchName)
}

export function isReleaseBranch(name: string): boolean {
    return name.startsWith("rel")
}

export async function getSecretForFeatureBranch(branchName: string, env: Env): Promise<void> {
    const keyVaultUri = getKeyVaultUri(env)
    try {
        const secretName = getSecretNameFromBranch(branchName)
        const { value } = await getKeyVaultSecret(keyVaultUri, secretName)
        const filePath = buildConfigFilePath(branchName, env)
        log(`Writing secrets to ${filePath}`);
        await dumpJSON(JSON.parse(value), filePath)
    } catch (error) {

        if (error?.output?.includes("SecretNotFound")) {
            log(`Secrets for given branch: ${branchName}, not exits on env: ${env}`)
            log("Trying to fetch default secrets...")
            const { value } = await getKeyVaultSecret(keyVaultUri, DEFAULT_SECRET_NAME)
            const filePath = buildConfigFilePath(branchName, env)
            await dumpJSON(JSON.parse(value), filePath)
        } else {
            log(error)
        }
    }
}

export async function getSecretForReleaseBranch(branchName: string, env: Env): Promise<void> {
    const keyVaultUri = getKeyVaultUri(env)
    try {
        const secretName = getSecretNameFromBranch(branchName)
        const { value } = await getKeyVaultSecret(keyVaultUri, secretName)
        const filePath = buildConfigFilePath(branchName, env)
        log(`Writing secrets to ${filePath}`);
        await dumpJSON(JSON.parse(value), filePath)
    } catch (error) {
        if (error?.output?.includes("SecretNotFound")) {
            log(`Secrets for given branch: ${branchName}, not exits on env: ${env}`)
        } else {
            log(error)

        }
    }
}

export async function createReleaseSecretFromOtherBranch(sourceBranchName: string, releaseBranchName: string, env: Env): Promise<void> {
    const keyVaultUri = getKeyVaultUri(env)
    try {
        const { value } = await getKeyVaultSecret(keyVaultUri, getSecretNameFromBranch(sourceBranchName))
        const filePath = buildConfigFilePath(releaseBranchName, env)
        await dumpJSON(JSON.parse(value), filePath)
        await setKeyVaultSecret(keyVaultUri, getSecretNameFromBranch(releaseBranchName), filePath)
    } catch (error) {
        if (error?.output?.includes("SecretNotFound")) {
            log(`Secrets for given branch: ${sourceBranchName}, not exits on env: ${env}`)
        } else {
            log(error)

        }
    }
}

export async function getSecretFromKeyVault(env: Env, keyVaultUri: string, secretName: string): Promise<KeyVaultSecret> {
    try {
        log(`Looking for secret: ${secretName} on env: ${env}`)
        return await getKeyVaultSecret(keyVaultUri, secretName)
    } catch (error) {
        if (error?.output?.includes("SecretNotFound")) {
            log(`Not found... Trying to fetch default secret: ${DEFAULT_SECRET_NAME}`)
            return getKeyVaultSecret(keyVaultUri, DEFAULT_SECRET_NAME)
        }
        throw new Error(error)
    }
}

export async function getTerraformOutputSecret(env: Env): Promise<void> {
    const secretName = "tf-output"
    const keyVaultUri = getKeyVaultUri(env)
    try {
        const { value } = await getKeyVaultSecret(keyVaultUri, secretName)
        const filePath = buildTerraformOutputsFilePath(env)
        log(`Writing secrets to ${filePath}`);
        await dumpJSON(JSON.parse(value), filePath)
    } catch (error) {
        if (error?.output?.includes("SecretNotFound")) {
            log(`Terraform output not found on env: ${env}. Please check keyvault manually`)
        } else {
            log(error)
        }
    }

}

export async function loadSecrets(env: Env, branchName: string): Promise<BindersSecrets> {
    const candidates = [
        branchName,
        process.env.BITBUCKET_PR_DESTINATION_BRANCH,
        DEFAULT_SECRET_NAME
    ];
    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }
        try {
            const secretName = getSecretNameFromBranch(candidate);
            return await loadBindersSecrets(env, secretName);
        } catch (error) {
            log(`Can't find specific secret for branch ${candidate}`)
        }
    }
    throw new Error(`No secret found for any of the candidates: ${candidates.join(", ")}`);
}


/*
 * NOTE: This is an unconventional way of storing the secrets in keyvault and was
 * done due to the necessity of getting those values in the pipeline. It is not
 * recommended for overloaded values, prefer the classic style of storing the whole binders config.
 */
export async function loadDevLaunchDarklyConfig(env: Env): Promise<LaunchDarklyConfig> {
    const keyVaultUri = getKeyVaultUri(env)
    const sdkKeySecretName = "launch-darkly-sdk-key"
    const clientSideIdSecretName = "launch-darkly-client-side-id"
    try {
        const [clientSideId, sdkKey] = await Promise.all(
            [clientSideIdSecretName, sdkKeySecretName].map(secretName =>
                getKeyVaultSecret(keyVaultUri, secretName).then(secret => secret.value)
            )
        );

        if (!clientSideId || !sdkKey) {
            throw new Error("One of the secrets is missing or undefined.")
        }
        return { clientSideId, sdkKey }

    } catch (error) {
        throw new Error(error)
    }
}

