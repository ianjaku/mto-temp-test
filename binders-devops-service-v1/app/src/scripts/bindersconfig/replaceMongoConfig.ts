import {
    BindersConfig,
    getMongoClusterConfig
} from "../../lib/bindersconfig";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { createK8SSecretFromFiles, getK8SSecret } from "../../actions/k8s/secrets";
import { base64decode } from "../../lib/base64";
import { dumpJSON } from "../../lib/json";
import { main } from "../../lib/program";


const SECRET_NAME = "binders-config"
const FILE_PATH = "/tmp/secret-to-update.json"
const CONFIG_FILE_NAME = {
    "staging": "staging.json",
    "production": "production.json",
    "dev": "development.json"
}


interface EnvironmentOption {
    env: string
    namespace?: string
    nodeNumber?: boolean
}

const getEnvironmentOptions = (): EnvironmentOption => {
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
            required: true
        },
        nodeNumber: {
            long: "nodeNumber",
            kind: OptionType.INTEGER,
            description: "Node number in mongo cluster. For more than one node we need config with replicaSet",
            required: false,
            default: 3
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


const updateMongoConfig = async (config: BindersConfig, mongoNodeNumber = 3) => {
    config.mongo.clusters.main = getMongoClusterConfig("mongo-main-service","mongo-main-service", mongoNodeNumber)
    return config
}

const doIt = async () => {
    const { env, namespace } = getEnvironmentOptions()
    const configFileName = getConfigFileName(env)
    const bindersConfig = await getBindersConfig(configFileName, namespace)
    const modifiedBindersConfig = await updateMongoConfig(bindersConfig)
    await saveBindersConfig(modifiedBindersConfig, configFileName, namespace)
}

main(doIt);


