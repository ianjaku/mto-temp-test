import {
    BindersSecrets,
    loadDevSecret,
    loadProductionSecrets,
    loadStagingSecrets
} from "../../lib/bindersconfig";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    MONGO_ADMIN_LOGIN,
    createUsersWithPassword,
    extractAdminCredentials,
} from "../../actions/mongo/user";
import { main } from "../../lib/program";
import { parseEnv } from "../../lib/environment";
import { runGetKubeCtlConfig } from "../../lib/commands";

interface ICreateMongServiceUserOptions {
    aksClusterName: string;
    serviceName: string;
    env: string;
    namespace: string
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
        serviceName: {
            long: "service-name",
            short: "s",
            description: "Name of the microservice for which you are creating a user",
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
        }
    };
    const parser = new CommandLineParser("createServiceUser", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as ICreateMongServiceUserOptions;
};

const doIt = async () => {
    const { aksClusterName, serviceName, namespace, env } = getOptions();
    const environment = parseEnv(env)
    const secretsLoaderMap = {
        "dev": loadDevSecret,
        "staging": loadStagingSecrets,
        "production": loadProductionSecrets
    }
    const secretsLoader = secretsLoaderMap[environment] as ((branchName?: string) => Promise<BindersSecrets>)
    const secrets = await secretsLoader()
    await runGetKubeCtlConfig(aksClusterName);
    const login = `${serviceName}_service`;
    const credentials = secrets.mongo.credentials
    const adminPassword = extractAdminCredentials(secrets.mongo.credentials)
    await createUsersWithPassword({
        adminLogin: MONGO_ADMIN_LOGIN,
        adminPassword,
        authenticated: true,
        forceReplicaSet: false,
        users: [{
            login,
            password: credentials[login],
            roles: [{ role: "readWrite", db: login }]
        }],
        namespace,
    });

};

main(doIt);

