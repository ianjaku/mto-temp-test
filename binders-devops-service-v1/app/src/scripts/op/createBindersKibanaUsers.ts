/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { Env, parseEnv } from "../../lib/environment";
import { base64decode } from "../../lib/base64";
import { createKubeConfig } from "../../actions/k8s-client/util";
import { fetchOnePasswordSecrets } from "../../actions/op";
import { getK8SSecret } from "../../actions/k8s/secrets";
import { handleAsyncWithErrorLog } from "../../lib/utils";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { upsertUser } from "../../actions/elastic/user";

interface ICreateKibanaUsersOptions {
    clusterName: string;
    namespace: string
    env: Env;
}

const MONITORING_NAMESPACE = "monitoring"

function getElasticHost(env: Env, namespace: string) {
    return `binders-es-http.${namespace}`
}

async function getElasticPassword(namespace: string) {
    const secretName = "binders-es-elastic-user"
    const secret = await getK8SSecret(secretName, namespace)
    const encoded = secret?.data?.elastic;
    return encoded ? base64decode(encoded) : "";
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        clusterName: {
            long: "cluster-name",
            short: "c",
            description: "The name of the kubernetes cluster",
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
        namespace: {
            long: "namespace",
            short: "n",
            description: "The name of the elastic cluster",
            kind: OptionType.STRING,
            default: "develop"
        }
    };
    const parser = new CommandLineParser("ICreateKibanaUsersOptions", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as ICreateKibanaUsersOptions;
};


main(async () => {
    const { clusterName, env, namespace } = getOptions()
    const environment = parseEnv(env)
    const kubeConfig = await createKubeConfig(clusterName, { useAdminContext: true });
    const users = await handleAsyncWithErrorLog(fetchOnePasswordSecrets, kubeConfig, "kibana-binders", MONITORING_NAMESPACE)
    log("Fetched 1passwords secrets")
    const host = getElasticHost(environment, namespace)
    log(`Build elastic host: ${host}`)
    const elasticPassword = await handleAsyncWithErrorLog(getElasticPassword, namespace)
    log("Fetched elastic password")
    const roles = ["viewer"]
    for (const user of users) {
        const { password, username } = user
        log(`Updating user ${username}`)
        const userConfig = {
            elasticPassword,
            host,
            password,
            roles,
            username
        }
        await upsertUser(userConfig)
    }
});
