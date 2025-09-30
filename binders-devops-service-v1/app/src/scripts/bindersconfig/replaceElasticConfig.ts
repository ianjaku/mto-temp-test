import * as path from "path";
import {
    BindersConfig,
    BindersSecrets,
    ElasticClusterConfig,
    getElasticProductionConfig
} from  "../../lib/bindersconfig";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { Env, parseEnv } from "../../lib/environment";
import { createK8SSecretFromFiles, getK8SSecret } from "../../actions/k8s/secrets";
import { getKeyVaultSecret, setKeyVaultSecret } from "../../actions/azure/keyvault";
import { base64decode } from "../../lib/base64";
import { dumpJSON } from "../../lib/json";
import { getElasticConfig } from "../../actions/elastic/config";
import { loadKeyVaultData } from "../../lib/terraform";
import { main } from "../../lib/program";


const SECRET_NAME = "binders-config"
const FILE_PATH = "/tmp/secret-to-update.json"
const CONFIG_FILE_NAME = {
    "staging": "staging.json",
    "production": "production.json",
    "dev": "development.json"
}

const SECRETS_FILE_NAME = {
    "staging": "dev.secrets.json",
    "production": "production.secrets.json",
    "dev": "local.secrets.json"
}

interface EnvironmentOption {
    env: string
    namespace?: string
    revertConfig?: boolean
}

const getEnvironmentOptions = (namespaceRequired = false): EnvironmentOption => {
    const programDefinition: IProgramDefinition = {
        env: {
            long: "env",
            short: "e",
            kind: OptionType.STRING,
            description: "environment (dev, staging or production)",
            required: true
        },
        namespace: {
            long: "namespace",
            short: "n",
            kind: OptionType.STRING,
            description: "k8s namespace",
            required: namespaceRequired
        },
        revertConfig: {
            long: "revertConfig",
            short: "r",
            kind: OptionType.BOOLEAN,
            description: "Revert elastic config back to version 5.6",
            required: false
        }
    }
    const parser = new CommandLineParser("EnvironmentOption", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any>parser.parse()) as EnvironmentOption
}

const getConfigFileName = (env: string): string => {
    const file = CONFIG_FILE_NAME[env]
    if (file) {
        return file
    }
    throw new Error(`Wrong environment ${env}`)
}

const getBindersConfig = async (configFileName: string, namespace: string) => {
    const secret = await getK8SSecret(SECRET_NAME, namespace);
    const decoded = base64decode(secret.data[configFileName])
    return JSON.parse(decoded) as BindersConfig
};

const saveBindersConfig = async (config: BindersConfig, configFileName: string, namespace: string) => {
    await dumpJSON(config, FILE_PATH)
    await createK8SSecretFromFiles(SECRET_NAME, {
        [configFileName]: FILE_PATH,
    }, namespace, true);
}

const fetchElasticClusterConfig = async (namespace: string, revert: boolean): Promise<ElasticClusterConfig> => {
    if (revert) {
        return Promise.resolve(getElasticProductionConfig("binders", "5.6"))
    }
    return getElasticConfig(namespace)
}

const updateElasticConfig = async (config: BindersConfig, elasticConfig: ElasticClusterConfig) => {
    config.elasticsearch.clusters["binders"] = elasticConfig
    config.elasticsearch.clusters["useractions"] = elasticConfig
    return config
}

const loadSecret = async (keyVaultUri: string, secretName: string): Promise<BindersSecrets> => {
    const { value } = await getKeyVaultSecret(keyVaultUri, secretName)
    return JSON.parse(value) as BindersSecrets
}

const updateBindersSecret = async (environment: Env) => {
    const { keyVaultUri, secretName } = await loadKeyVaultData(environment)
    const secret = await loadSecret(keyVaultUri, secretName)
    const secretFilePath = path.join(__dirname + "/../../config/" + SECRETS_FILE_NAME[environment])
    await dumpJSON(secret, secretFilePath)
    await setKeyVaultSecret(keyVaultUri, secretName, secretFilePath)
}

const doIt = async () => {
    const namespaceRequired = true
    const { env, namespace, revertConfig } = getEnvironmentOptions(namespaceRequired)
    const environment = parseEnv(env)
    const configFileName = getConfigFileName(env)
    const bindersConfig = await getBindersConfig(configFileName, namespace)
    const elasticConfig = await fetchElasticClusterConfig(namespace, revertConfig)
    const modifiedBindersConfig = await updateElasticConfig(bindersConfig, elasticConfig)
    await saveBindersConfig(modifiedBindersConfig, configFileName, namespace)
    await updateBindersSecret(environment)
}

main(doIt);
