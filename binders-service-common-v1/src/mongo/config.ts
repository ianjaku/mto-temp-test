import { Config, ConfigError } from "@binders/client/lib/config/config";
import { Either, Maybe } from "@binders/client/lib/monad";
import { isProduction, isStaging } from "@binders/client/lib/util/environment";
import { ConnectOptions } from "mongoose";

export interface HostWithPort {
    host: string;
    port: number;
}

export interface CollectionConfigOptions {
    transformCollectionName?: (name: string) => string;
    connectionSettings?: ConnectionSettings;
}

export interface ConnectionSettings {
    timeoutMs: number;
}

const DEFAULT_MONGO_TIMEOUT = 60000;

export class ConnectionConfig {

    static MONGO_URI_PROTOCOL = "mongodb://";

    constructor(
        public readonly hostDetails: HostWithPort[],
        public readonly login: Maybe<string> = Maybe.nothing<string>(),
        public readonly password: Maybe<string> = Maybe.nothing<string>(),
        public readonly database: string = "test",
        public readonly replicaSet: Maybe<string> = Maybe.nothing<string>(),
        public readonly connectionSettings: Maybe<ConnectionSettings> = Maybe.nothing<ConnectionSettings>(),
    ) { }

    toConnectionString(): string {
        const connString = ConnectionConfig.MONGO_URI_PROTOCOL +
                this.getLoginAndPasswordInfix() +
                this.getHostsDetailsInfix() +
                "/" + this.database;
        const suffixParts = [];
        if (this.password.isJust()) {
            suffixParts.push("authSource=admin");
        }
        if (this.replicaSet.isJust()) {
            suffixParts.push(`replicaSet=${this.replicaSet.get()}`);
        }
        const suffix = suffixParts.length > 0 ? ("?" + suffixParts.join("&")) : "";
        return connString + suffix;
    }

    getConnectOptions(): ConnectOptions {
        const timeout = this.connectionSettings
            .lift(s => s.timeoutMs)
            .getOrElse(DEFAULT_MONGO_TIMEOUT);
        return {
            connectTimeoutMS : timeout,
            socketTimeoutMS: timeout,
            autoIndex: false,
        }
    }

    private getLoginAndPasswordInfix() {
        if (!this.login.isJust()) {
            return "";
        }
        return this.password.caseOf({
            just: password => `${this.login.get()}:${encodeURIComponent(password)}@`,
            nothing: () => `${this.login.get()}@`
        });
    }

    private getHostsDetailsInfix() {
        const stringParts: string[] = this.hostDetails.reduce((accumulator, hostWithPort) => {
            accumulator.push( hostWithPort.host + ":" + hostWithPort.port );
            return accumulator;
        }, []);
        return stringParts.join(",");
    }
}

export class CollectionConfig {
    constructor(public connectionConfig: ConnectionConfig, public collectionName: string) { }

    static getLocalCollectionConfig(collectionName: string): CollectionConfig {
        const hosts = [
            { host: "127.0.0.1",  port: 27017 }
        ];
        const connectionConfig = new ConnectionConfig(hosts);
        return new CollectionConfig(connectionConfig, collectionName);
    }

    static fromConfig(config: Config, collectionName: string, loginOption: Maybe<string> = Maybe.nothing<string>(), options?: CollectionConfigOptions): Either<Error, CollectionConfig> {
        const collectionKey = "mongo.collections." + collectionName;
        const transformCollectionName = (options && options.transformCollectionName) || ((name: string) => name);
        const configValueOptions = {
            "database": config.getString(collectionKey + ".database"),
            "collection": config.getString(collectionKey + ".collection").lift(transformCollectionName),
            "cluster": config.getString(collectionKey + ".cluster")
        };
        const possibleCollectionConfig = Maybe.unpack(configValueOptions)
            .bind( (configValues) => {
                const clusterKey = "mongo.clusters." + configValues.cluster;
                const instancesOption = config.getArray<HostWithPort>(clusterKey + ".instances");
                const replicaSetOption = config.getString(clusterKey + ".replicaSet");
                const connectionSettings = options && options.connectionSettings && Maybe.just(options.connectionSettings);
                return instancesOption.caseOf({
                    nothing: () => Either.left<Error, CollectionConfig>(new ConfigError("Could not find cluster details")),
                    just: (instances) => {
                        const passwordOption = loginOption.bind(login => {
                            return config.getString("mongo.credentials." + login);
                        });
                        const connectionConfig = new ConnectionConfig(
                            instances,
                            loginOption,
                            passwordOption,
                            configValues.database,
                            replicaSetOption,
                            connectionSettings
                        );
                        return Either.right<Error, CollectionConfig>(new CollectionConfig(connectionConfig, configValues.collection));
                    }
                });
            });
        return possibleCollectionConfig.caseOf<Either<Error, CollectionConfig>>({
            left: error => Either.left<Error, CollectionConfig>(new ConfigError(`Invalid config for collection ${collectionName}: ${error.toString()}`)),
            right: colConfig => Either.right<Error, CollectionConfig>(colConfig)
        });
    }


    static promiseFromConfig(config: Config, collectionName: string, loginOption: Maybe<string>, options?: CollectionConfigOptions): Promise<CollectionConfig> {
        return CollectionConfig.fromConfig(config, collectionName, loginOption, options)
            .caseOf({
                left: error => Promise.reject(error),
                right: collectionConfig => Promise.resolve(collectionConfig)
            });
    }
}

export type ServiceName = "account_service" |
    "authorization_service" |
    "credential_service" |
    "image_service" |
    "repository_service" |
    "routing_service" |
    "tracking_service" |
    "user_service" |
    "common" |
    "notification_service" |
    "public_api";

export const getMongoLogin = (serviceName: ServiceName): Maybe<string> => (
    isProduction() || isStaging() ?
        Maybe.just(serviceName) :
        Maybe.nothing<string>()
);
