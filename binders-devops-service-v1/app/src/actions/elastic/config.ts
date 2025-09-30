import { Client, ClientOptions } from "@elastic/elasticsearch";
import { ELASTIC_CLUSTER_NAME, getElasticUserPassword } from "../../lib/eck";
import { HelmReleaseType, getHelmReleaseName } from "../helm/config";
import { ElasticClusterConfig } from "../../lib/bindersconfig"

const getBasicAuthForElastic = (elasticPassword: string): string => `elastic:${elasticPassword}`

export const getHelmElasticReleaseName = (elasticClusterName: string, releaseType: HelmReleaseType): string => (
    getHelmReleaseName("elastic", elasticClusterName, releaseType)
);

function toElasticNode(host: string) {
    return `http://${host}`;
}

function toElasticClientConfig(clusterConfig: ElasticClusterConfig): ClientOptions {
    const clientConfig = { ...clusterConfig };
    if (clusterConfig.host) {
        clientConfig["node"] = toElasticNode(clusterConfig.host as string);
    }
    if (clusterConfig.hosts) {
        clientConfig["nodes"] = (clusterConfig.hosts as string[]).map(toElasticNode);
    }
    if (clusterConfig.httpAuth) {
        const [username, password] = (clusterConfig.httpAuth as string).split(":");
        clientConfig["auth"] = { username, password };
    }
    return clientConfig as ClientOptions;
}

export const getClient = (config: ElasticClusterConfig): Client => {
    const clientConfig = toElasticClientConfig(config);
    return new Client(clientConfig);
};

export const getLocalClient = (port = 9200): Client => {
    const config = {
        node: `http://localhost:${port}`,
        sniffOnStart: false,
        requestTimeout: 60000,
    };
    return new Client(config);
};

export const getNewElasticClient = (elasticPassword: string, apiVersion = "6.8"): Client => {
    const config = {
        apiVersion,
        host: `${ELASTIC_CLUSTER_NAME}-es-http:9200`,
        httpAuth: getBasicAuthForElastic(elasticPassword),
    }
    return new Client(toElasticClientConfig(config))
}

export const getElasticConfig = async (namespace: string): Promise<ElasticClusterConfig> => {
    const elasticPassword = await getElasticUserPassword(namespace)
    return {
        apiVersion: "6.8",
        host: `${ELASTIC_CLUSTER_NAME}-es-http:9200`,
        httpAuth: getBasicAuthForElastic(elasticPassword)
    };

}

export const getElasticClientForRestoreSnapshot = (elasticPassword: string, port = 9200, apiVersion = "6.8"): Client => {
    const config = {
        apiVersion,
        host: `localhost:${port}`,
        httpAuth: getBasicAuthForElastic(elasticPassword),
    };
    return new Client(toElasticClientConfig(config));
};

export const getElasticUriWithBasicAuthentication = async (namespace: string): Promise<string> => {
    const elasticPassword = await getElasticUserPassword(namespace)
    return `http://elastic:${elasticPassword}@${ELASTIC_CLUSTER_NAME}-es-http.${namespace}:9200`
}