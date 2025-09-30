/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { Env, parseEnv } from "../../lib/environment";
import { base64decode } from "../../lib/base64";
import { createKubeConfig } from "../../actions/k8s-client/util";
import { fetchOnePasswordSecrets } from "../../actions/op";
import { getElasticTlsCertificate } from "../../actions/elastic/certificate";
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

function getElasticHost(env: Env) {
    const prefix = env === "production" ? "logevents-new-es-http" : "logevents-es-http"
    return `${prefix}.monitoring`
}

async function getElasticPassword(env: Env, namespace: string) {
    const secretName = env === "production" ? "logevents-new-es-elastic-user" : "logevents-es-elastic-user"
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
            default: "monitoring"
        }
    };
    const parser = new CommandLineParser("ICreateKibanaUsersOptions", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as ICreateKibanaUsersOptions;
};

const getTLSSecretName = (environment: Env) => environment === "production" ? "logevents-new-es-http-certs-public" : "logevents-es-http-certs-public"

main(async () => {
    const { clusterName, env, namespace } = getOptions()
    const environment = parseEnv(env)
    const kubeConfig = await createKubeConfig(clusterName, { useAdminContext: true });
    const users = await handleAsyncWithErrorLog(fetchOnePasswordSecrets, kubeConfig, "kibana", namespace)
    log("Fetched 1passwords secrets")
    const host = getElasticHost(environment)
    log(`Build elastic host: ${host}`)
    const elasticPassword = await handleAsyncWithErrorLog(getElasticPassword, environment, namespace)
    log("Fetched elastic password")
    const roles = ["monitoring_user", "apm-reader", "filebeat-reader", "kibana_admin"]
    const certificate = await handleAsyncWithErrorLog(getElasticTlsCertificate, {
        key: "tls.crt",
        kubeConfig,
        namespace,
        secretName: getTLSSecretName(environment)
    })
    for (const user of users) {
        const { password, username } = user
        log(`Updating user ${username}`)
        const userConfig = {
            certificate,
            elasticPassword,
            host,
            password,
            roles,
            username
        }
        await upsertUser(userConfig)
    }
});
