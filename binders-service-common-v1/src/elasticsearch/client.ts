import { Client, ClientOptions } from "@elastic/elasticsearch";
import { Config, ConfigError } from "@binders/client/lib/config/config";

function toElasticNode(host: string) {
    return `http://${host}`;
}

function toElasticClientConfig(clusterConfig: Record<string, unknown>): ClientOptions {
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

export async function withClient<T>(
    config: Config,
    configKey: string,
    cb: (client: Client) => Promise<T>,
    extraElasticConfig: Record<string, unknown> = {},
): Promise<T> {
    const elasticConfig = config.getObject(configKey);
    if (elasticConfig.isJust()) {
        const clusterConfig = Object.assign({}, elasticConfig.get(), extraElasticConfig) as Record<string, unknown>;
        const clientConfig = toElasticClientConfig(clusterConfig);
        const client = new Client(clientConfig);
        try {
            return await cb(client);
        } finally {
            client.close();
        }
    }
    return Promise.reject(new ConfigError(`Missing config key ${configKey}`));
}


export function createElasticClient(config: Config, configKey: string, extraElasticConfig: Record<string, unknown> = {}): Client {
    const elasticConfig = config.getObject(configKey);
    if (elasticConfig.isJust()) {
        const clusterConfig = Object.assign({}, elasticConfig.get(), extraElasticConfig) as Record<string, unknown>;
        const clientConfig = toElasticClientConfig(clusterConfig);
        return new Client(clientConfig);
    }
    throw new ConfigError(`Missing config key ${configKey}`)

}