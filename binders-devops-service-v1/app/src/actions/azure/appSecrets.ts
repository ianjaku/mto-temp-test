import { BindersSecrets, replacePasswordInBindersSecrets } from "../../lib/bindersconfig";
import { createSecretClient, getAllSecretNames, getSecret, setSecret } from "./keyvault";
import { Application } from "@microsoft/microsoft-graph-types";
import { ApplicationClient } from "../../lib/graph";
import { Config } from "@binders/client/lib/config/config";
import { Env } from "../../lib/environment";
import { createClientSecretCredentialFromConfig } from "./clientSecretCredentials";
import {
    incrementAzureAppExpiredSecretCounter
} from  "@binders/binders-service-common/lib/monitoring/prometheus/appSecretExpired";
import log from "../../lib/logging";
import { willPasswordCredentialExpire } from "../../lib/graph/util";

interface ApplicationSecretMapping {
    pathInBindersSecrets: string[]
    keyVaultUsedInEnvs: Env[]
}

const mapping: Record<string, ApplicationSecretMapping> = {
    "ea56de9e-44b6-4e89-b991-dd3526cd851e": {
        pathInBindersSecrets: ["azure", "servicePrincipal", "devops", "password"],
        keyVaultUsedInEnvs: ["dev"]
    },
    //devops-pipeline
    "014d790a-6f05-4590-a41e-549939389546": {
        pathInBindersSecrets: ["azure", "servicePrincipal", "devops", "password"],
        keyVaultUsedInEnvs: ["staging", "production"]
    },
    //transactable-offers
    "294cbbde-31d9-4241-bd15-6a34355f2a0d": {
        pathInBindersSecrets: ["msTransactableOffers", "appSecret"],
        keyVaultUsedInEnvs: ["staging", "production"]
    }
}

const ENV_KEYVAULT_MAPPING: Record<Env, string> = {
    "dev": "develop",
    "staging": "develop",
    "production": "develop",
    "test": "develop",
}

function createAppClient(config: Config): ApplicationClient {
    const credential = createClientSecretCredentialFromConfig(config)
    return new ApplicationClient(credential)
}

export async function rotateSecrets(config: Config, dryRun = true, id?: string): Promise<boolean> {
    const client = createAppClient(config)
    const applications = id ? [await client.getApplication(id)] : (await client.listApplications()).value
    let allSecretsValid = true
    for (const application of applications) {
        if (willPasswordCredentialExpire(application)) {
            allSecretsValid = false
            log(`Detected expired password for app ${application.displayName}, id ${application.id}`)
            const newSecretText = dryRun ? "" : (await client.createPassword(application.id)).secretText
            const shouldSecretBeSyncedInKeyVault = mapping[application.id]
            if (shouldSecretBeSyncedInKeyVault) {
                log("Detected mapping between app and keyvaults")
                await syncPasswordCredentialWithKeyVault(config, application, mapping, newSecretText, dryRun)
                continue
            }
            log("No mapping between app and keyvaults. Sending notification to prometheus.")
        } else {
            log(`Passwords are not expired for app ${application.displayName}, id ${application.id}`)
        }
    }
    return allSecretsValid
}


async function syncPasswordCredentialWithKeyVault(config: Config, application: Application, mappings: Record<string, ApplicationSecretMapping>, secretText: string, dryRun: boolean): Promise<void> {
    const { keyVaultUsedInEnvs, pathInBindersSecrets } = mappings[application.id]
    for (const env of keyVaultUsedInEnvs) {
        log(`Processing environment: ${env}`)
        const credential = createClientSecretCredentialFromConfig(config)
        const secretClient = createSecretClient(credential, ENV_KEYVAULT_MAPPING[env])
        const namesOfSecrets = await getAllSecretNames(secretClient)
        for (const name of namesOfSecrets) {
            const secret = await getSecret(secretClient, name)
            if (!dryRun && !secretText) {
                log(`Updating password under path ${pathInBindersSecrets.toString()}. Secret: ${name}. KeyVault: ${ENV_KEYVAULT_MAPPING[env]}`)
                try {
                    const replacedSecrets = replacePasswordInBindersSecrets(JSON.parse(secret.value) as BindersSecrets, secretText, pathInBindersSecrets)
                    await setSecret(secretClient, name, replacedSecrets)
                } catch (error) {
                    log(`Error during udating password under path ${pathInBindersSecrets.toString()}. Secret: ${name}. KeyVault: ${ENV_KEYVAULT_MAPPING[env]}`)
                    log(error)
                    sendNotificationToPrometheus(application.displayName, dryRun)
                }
            } else {
                log(`[Dry run] Updating password under path ${pathInBindersSecrets.toString()}. Secret: ${name}. KeyVault: ${ENV_KEYVAULT_MAPPING[env]}`)
            }
        }
    }
}

async function sendNotificationToPrometheus(applicationName: string, dryRun: boolean) {
    if (dryRun) {
        return
    }
    log(`Expired password notification for app: ${applicationName}`)
    incrementAzureAppExpiredSecretCounter(applicationName)
}


