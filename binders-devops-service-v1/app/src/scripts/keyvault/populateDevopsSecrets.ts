import { getEnvironmentOptions, parseEnv } from "../../lib/environment";
import { dirname } from "path";
import { dumpJSON } from "../../lib/json";
import { getKeyVaultSecret } from "../../actions/azure/keyvault";
import { loadKeyVaultData } from "../../lib/terraform";
import { main } from "../../lib/program";
import { realpathSync } from "fs";

const currentDir = realpathSync(dirname(__filename));
const DEVOPS_SECRET_FILENAME = `${currentDir}/../../config/devops.secrets.json`;

const doIt = async () => {
    const { env } = getEnvironmentOptions();
    const environment = parseEnv(env)
    const { keyVaultUri, devopsSecretName } = await loadKeyVaultData(environment)

    const { value } = await getKeyVaultSecret(keyVaultUri, devopsSecretName)
    await dumpJSON(JSON.parse(value), DEVOPS_SECRET_FILENAME)
}

main(doIt)