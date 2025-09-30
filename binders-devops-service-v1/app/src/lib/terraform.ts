import { Env } from "./environment";
import { KeyVaultData } from "./bindersconfig";
import { loadFile } from "./fs";
import { realpathSync } from "fs";

const KEYVAULT_URI_ENV_MAPPING = {
    "dev": "https://binderdevbindersmedia.vault.azure.net/",
    "staging": "https://binderstgbindersmedia.vault.azure.net/",
    "production": "https://binderprodbindersmedia.vault.azure.net/"
}


interface StorageContainerOutput {
    account: string;
    name: string
}

interface TerraformStringOutput {
    sensitive: boolean;
    value: string;
}

interface TerraformObjectOutput {
    sensitive: boolean;
    value: {
        [name: string]: string
    };
}

interface TerraformStorageContainersOutput {
    sensitive: boolean;
    value: StorageContainerOutput[]
}


export interface AzureTerraformOutput {
    account_id: TerraformStringOutput;
    bindersMediaSecret: TerraformStringOutput;
    cdnEndpoints: TerraformObjectOutput;
    devopsKeyVaultUri?: TerraformStringOutput;
    devopsSecret: TerraformStringOutput;
    keyVault: TerraformStringOutput;
    logAnalyticsWorkspaceId: TerraformStringOutput;
    resource_group: TerraformStringOutput;
    functions: TerraformObjectOutput;
    speechServiceAccessKey: TerraformStringOutput;
    storageAccountAccessKey: TerraformObjectOutput;
    storageAccountNames: TerraformObjectOutput
    storageContainers: TerraformStorageContainersOutput;
    subscription_id: TerraformStringOutput;
    tenant_id: TerraformStringOutput;
    terraformOutputSecretName?: TerraformStringOutput;
}

const getKeyVault = (terraformOutput: AzureTerraformOutput): KeyVaultData => {
    const { bindersMediaSecret, devopsSecret, keyVault } = terraformOutput
    return {
        keyVaultUri: `${keyVault.value}secrets/${bindersMediaSecret.value}`,
        secretName: bindersMediaSecret.value,
        devopsSecretName: devopsSecret.value
    }
}

export const loadTerraformOutput = async (env: Env): Promise<AzureTerraformOutput> => {
    const terraformOutputPath = __dirname + `/../config/terraform-outputs/outputs.${env}.json`
    const encoded = await loadFile(realpathSync(terraformOutputPath))
    return JSON.parse(encoded);
}


export const loadKeyVaultData = async (env: Env): Promise<KeyVaultData> => {
    const terraformOutput = await loadTerraformOutput(env);
    return getKeyVault(terraformOutput)
}

export const getKeyVaultUri = (env: Env): string => {
    const keyvaultUri = KEYVAULT_URI_ENV_MAPPING[env]
    if (!keyvaultUri) {
        throw new Error(`[Keyvault uri mapping error]: ${keyvaultUri} }`)
    }
    return keyvaultUri
}


