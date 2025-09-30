import { getEnvironmentOptions, parseEnv } from "../../lib/environment";
import { getKeyVaultSecret, setKeyVaultSecret } from "../../actions/azure/keyvault";
import { configDiff } from "../../lib/diff"
import { dirname } from "path"
import { loadJSON } from "../../lib/json"
import { loadKeyVaultData } from "../../lib/terraform"
import { main } from "../../lib/program"
import { realpathSync } from "fs"

const currentDir = realpathSync(dirname(__filename));

const DEVOPS_SECRET_FILENAME = `${currentDir}/../../config/devops.secrets.json`;



const doIt = async () => {
    const { env, dryRun } = getEnvironmentOptions();
    const environment = parseEnv(env)
    const { keyVaultUri, devopsSecretName } = await loadKeyVaultData(environment)

    const currentLocalDevopsSecrets = await loadJSON(DEVOPS_SECRET_FILENAME);
    const { value: currentVaultDevopsSecrets } = await getKeyVaultSecret(keyVaultUri, devopsSecretName);
    if (await configDiff("devops", JSON.parse(currentVaultDevopsSecrets), currentLocalDevopsSecrets, dryRun)) {
        await setKeyVaultSecret(keyVaultUri, devopsSecretName, DEVOPS_SECRET_FILENAME);
    }
}

main(doIt)


