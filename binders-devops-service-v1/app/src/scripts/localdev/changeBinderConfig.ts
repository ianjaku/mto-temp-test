/* eslint-disable no-console */
import { Env, isValidEnv, parseEnv } from "../../lib/environment";
import { createK8SSecretFromFiles, getK8SSecret } from "../../actions/k8s/secrets";
import { info, panic } from "@binders/client/lib/util/cli";
import { Command } from "commander";
import { base64decode } from "../../lib/base64";
import { dumpJSON } from "../../lib/json";
import { main } from "../../lib/program";
import { shortenBranchName } from "../../lib/k8s";

const SCRIPT_NAME = "Change BinderConfig";
const DEFAULT_FILE_PATH = "/tmp/secret-to-update.json"
const CONFIG_FILE_NAME = {
    "staging": "staging.json",
    "production": "production.json",
    "dev": "development.json"
}

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script will download/upsert binders config to k8s secret")
    .option("-b, --branch [branch]", "Specify branch prefix for binders config e.g rel-december-24 argument will look for rel-december-24-binders-config k8s secret")
    .option("-d, --download ", "Download flag binders config will be fetch into local disk")
    .option("-e, --env [env]", "Environment on which change is done, possible values: dev, staging, production")
    .option("-n, --namespace [namespace]", "Namespace where binders config exits/should be upsert")
    .option("-p, --path [path]", "Path to which config will be downloaded/from which will be uploaded", DEFAULT_FILE_PATH)
    .option("-u, --upsert [upsert]", "Upsert flag uploads binders config from local file into k8s secret")


interface ScriptOptions {
    branch?: string;
    download?: boolean
    env?: Env
    namespace?: string
    path?: string
    upsert?: boolean
}

program.parse(process.argv);
const options: ScriptOptions = program.opts();

const getBindersConfigName = (branch: string) => `${branch}-binders-config`

const getConfigFileName = (env: string): string => {
    const file = CONFIG_FILE_NAME[env]
    if (file) {
        return file
    }
    throw new Error(`Wrong environment ${env}`)
}

const dumpBindersConfig = async (configFileName: string, namespace: string, filePath: string, secretName: string) => {
    const secret = await getK8SSecret(secretName, namespace);
    const decodedBindersConfig = base64decode(secret.data[configFileName])
    await dumpJSON(JSON.parse(decodedBindersConfig), filePath)
};

const createNewSecret = async (configFileName: string, namespace: string, filePath: string, secretName: string) => {
    await createK8SSecretFromFiles(secretName, {
        [configFileName]: filePath,
    }, namespace, true);
}

const doIt = async () => {
    if (!options.branch) {
        panic("You need to provide branch for building binders config secret name, e.g -b develop")
    }

    if (!options.env && !isValidEnv(options.env)) {
        panic("You need to provide valid environment, possible values: dev, staging, production, e.g. -e staging")
    }

    if (!options.namespace) {
        panic("You need to provide namespace where binders config exists/should be deployed, e.g -n develop")
    }

    if (options.download === options.upsert) {
        panic("Please use either download or upsert option, not both.")
    }

    const { branch, download, env, namespace, path, upsert } = options
    const environment = parseEnv(env)
    const configFileName = getConfigFileName(environment)
    const secretName = getBindersConfigName(shortenBranchName(branch))
    info(`Calculated binders config secret name: ${secretName}`)
    if (download) {
        await dumpBindersConfig(configFileName, namespace, path, secretName)
        info(`config ${configFileName} for ${namespace} dumped to ${path}`);
    }
    if (upsert) {
        await createNewSecret(configFileName, namespace, path, secretName)
        info(`config ${configFileName} for ${namespace} created from ${path}`);
    }
};

main(doIt);
