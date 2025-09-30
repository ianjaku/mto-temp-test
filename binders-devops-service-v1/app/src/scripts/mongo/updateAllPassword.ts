import {
    BindersSecrets,
    loadDevSecret,
    loadProductionSecrets,
    loadStagingSecrets
} from "../../lib/bindersconfig";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { getAdminCredentials } from "../../actions/mongo/config";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { parseEnv } from "../../lib/environment";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { sequential } from "../../lib/promises";
import { updatePassword } from "../../actions/mongo/user";

interface ICreateMongServiceUserOptions {
    aksClusterName: string;
    env: string;
    namespace: string
    forceReplicaSet: boolean
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        namespace: {
            long: "namespace",
            description: "The name of the k8s namespace",
            kind: OptionType.STRING,
            required: true
        },
        env: {
            long: "env",
            short: "e",
            kind: OptionType.STRING,
            description: "environment (dev, staging or production)",
            required: true
        },
        forceReplicaSet: {
            long: "force-replica-set",
            kind: OptionType.BOOLEAN,
            description: "Add replicaset parameter",
            default: false
        }
    };
    const parser = new CommandLineParser("updatePassword", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown> parser.parse()) as ICreateMongServiceUserOptions;
};

const doIt = async () => {
    const { aksClusterName, namespace, env, forceReplicaSet } = getOptions();
    const adminCredentials = getAdminCredentials()
    const environment = parseEnv(env)
    const secretsLoaderMap = {
        "dev": loadDevSecret,
        "staging": loadStagingSecrets,
        "production": loadProductionSecrets
    }
    const secretsLoader = secretsLoaderMap[environment] as ((branchName?: string) => Promise<BindersSecrets>)
    log("Start loading secrets...")
    const secrets = await secretsLoader()
    await runGetKubeCtlConfig(aksClusterName, true);
    log("Preparing users for update")
    const credentials = secrets.mongo.credentials
    const users = Object.keys(credentials)
    log("Start update")
    await sequential(
        async (login) => {
            log(`Updating password for ${login}`);
            await updatePassword({
                adminLogin: adminCredentials.login,
                adminPassword: adminCredentials.password,
                forceReplicaSet,
                login,
                namespace,
                password: credentials[login]
            });
        },
        users
    );
};

main(doIt);

