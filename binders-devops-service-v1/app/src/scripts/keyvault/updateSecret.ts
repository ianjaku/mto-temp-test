import {
    buildConfigFilePath,
    getSecretFromKeyVault,
    getSecretNameFromBranch
} from "../../lib/secrets";
import { getEnvironmentOptions, parseEnv } from "../../lib/environment";
import { configDiff } from "../../lib/diff";
import { getCurrentBranch } from "../../actions/git/branches";
import { getKeyVaultUri } from "../../lib/terraform";
import { loadJSON } from "../../lib/json";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { setKeyVaultSecret } from "../../actions/azure/keyvault";


const doIt = async () => {
    const { env, dryRun } = getEnvironmentOptions();
    const environment = parseEnv(env)
    const keyVaultUri = await getKeyVaultUri(environment)
    const branchName = await getCurrentBranch()
    log(`Your current branch is ${branchName}`)
    const secretName = getSecretNameFromBranch(branchName)
    const filePath = buildConfigFilePath(branchName, environment)
    log(`Loading local config file: ${filePath} for secret: ${secretName} `)
    let currentLocalSecrets
    try {
        currentLocalSecrets = await loadJSON(filePath);
    } catch (error) {
        log(`[ERROR]: File ${filePath} not exists on filesystem. Please run populateSecretsFromKeyVault.ts script to create it!`)
        process.exit(1)
    }
    log("Loading remote secret from Azure KeyVault")
    const { value: currentVaultSecrets } = await getSecretFromKeyVault(environment, keyVaultUri, secretName)
    if (await configDiff(env, JSON.parse(currentVaultSecrets), currentLocalSecrets, dryRun)) {
        await setKeyVaultSecret(keyVaultUri, secretName, filePath);
    }
}

main(doIt)


