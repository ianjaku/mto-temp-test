import { CollectionConfig, ConnectionConfig } from "../../../src/mongo/config";
import { Config, ObjectConfig } from "@binders/client/lib/config/config";
import { Maybe } from "@binders/client/lib/monad";

const mongoConfigNoCredentials = {
    mongo: {
        clusters: {
            main: {
                instances: [{ host: "10.10.10.10", port: 3333 }]
            }
        },
        collections: {
            users: {
                cluster: "main",
                database: "bindersdb",
                collection: "users"
            }
        }
    }
};

const mongoConfigWithCredentials = {
    mongo: {
        clusters: {
            main: {
                instances: [{ host: "10.10.10.10", port: 3333 }]
            }
        },
        collections: {
            users: {
                cluster: "main",
                database: "bindersdb",
                collection: "users"
            }
        },
        credentials: {
            testuser: "testpassword"
        }
    }
};

const mongoConfigWithReplicaSet = {
    mongo: {
        clusters: {
            main: {
                instances: [{ host: "10.10.10.10", port: 3333 }],
                replicaSet: "someReplicaSet"
            }
        },
        collections: {
            users: {
                cluster: "main",
                database: "bindersdb",
                collection: "users"
            }
        },
        credentials: {
            testuser: "testpassword"
        }
    }
};

describe("mongo connection config", () => {
    it("constructs a simple connection string", () => {
        const hosts = [{ host: "server1", port: 2014 }, { host: "server2", port: 2017 }];
        const connectionConfig = new ConnectionConfig(hosts);
        const connectionString = connectionConfig.toConnectionString();
        expect(connectionString).toEqual("mongodb://server1:2014,server2:2017/test");
    });

    it("constructs a connection string (login no password)", () => {
        const hosts = [{ host: "server1", port: 2014 }, { host: "server2", port: 2017 }];
        const login = Maybe.just("tom");
        const connectionConfig = new ConnectionConfig(hosts, login);
        const connectionString = connectionConfig.toConnectionString();
        expect(connectionString).toEqual("mongodb://tom@server1:2014,server2:2017/test");
    });

    it("constructs a connection string (login and password)", () => {
        const hosts = [{ host: "server1", port: 2014 }, { host: "server2", port: 2017 }];
        const login = Maybe.just("tom");
        const password = Maybe.just("password");
        const connectionConfig = new ConnectionConfig(hosts, login, password);
        const connectionString = connectionConfig.toConnectionString();
        expect(connectionString).toEqual("mongodb://tom:password@server1:2014,server2:2017/test?authSource=admin");
    });

    it("constructs a connection string (login and password) for restore (no default db)", () => {
        const hosts = [{ host: "server1", port: 2014 }, { host: "server2", port: 2017 }];
        const login = Maybe.just("tom");
        const password = Maybe.just("password");
        const connectionConfig = new ConnectionConfig(hosts, login, password, "", Maybe.nothing());
        const connectionString = connectionConfig.toConnectionString();
        expect(connectionString).toEqual("mongodb://tom:password@server1:2014,server2:2017/?authSource=admin");
    });


    it("constructs a connection string no credentials for restore (no default db)", () => {
        const hosts = [{ host: "server1", port: 2014 }];
        const connectionConfig = new ConnectionConfig(hosts, Maybe.nothing(), Maybe.nothing(), "", Maybe.nothing());
        const connectionString = connectionConfig.toConnectionString();
        expect(connectionString).toEqual("mongodb://server1:2014/");
    });

    it("constructs a connection string (non-default db)", () => {
        const hosts = [{ host: "server1", port: 2014 }, { host: "server2", port: 2017 }];
        const missing = Maybe.nothing<string>();
        const connectionConfig = new ConnectionConfig(hosts, missing, missing, "users");
        const connectionString = connectionConfig.toConnectionString();
        expect(connectionString).toEqual("mongodb://server1:2014,server2:2017/users");
    });

    it("constructs a connection string (full)", () => {
        const hosts = [{ host: "server1", port: 2014 }, { host: "server2", port: 2017 }];
        const login = Maybe.just("tom");
        const password = Maybe.just("password");
        const connectionConfig = new ConnectionConfig(hosts, login, password, "users");
        const connectionString = connectionConfig.toConnectionString();
        expect(connectionString).toEqual("mongodb://tom:password@server1:2014,server2:2017/users?authSource=admin");
    });

    it("builds the connection string from a config object (no credentials)", () => {
        const config: Config = new ObjectConfig(mongoConfigNoCredentials);
        const collectionConfig = CollectionConfig.fromConfig(config, "users");
        collectionConfig.caseOf({
            left: () => {
                throw new Error("Could not build config object");
            },
            right: colConfig => {
                const conConfig = colConfig.connectionConfig;
                const connString = conConfig.toConnectionString();
                expect(connString).toEqual("mongodb://10.10.10.10:3333/bindersdb");
                expect(colConfig.collectionName).toEqual("users");
            }
        });
    });

    it("builds the connection string from a config object (with credentials)", () => {
        const config: Config = new ObjectConfig(mongoConfigWithCredentials);
        const collectionConfig = CollectionConfig.fromConfig(config, "users", Maybe.just("testuser"));
        collectionConfig.caseOf({
            left: () => {
                throw new Error("Could not build config object");
            },
            right: colConfig => {
                const conConfig = colConfig.connectionConfig;
                const connString = conConfig.toConnectionString();
                expect(connString).toEqual(
                    "mongodb://testuser:testpassword@10.10.10.10:3333/bindersdb?authSource=admin"
                );
                expect(colConfig.collectionName).toEqual("users");
            }
        });
    });

    it("builds the connection string from a config object (with credentials and replicaSet)", () => {
        const config: Config = new ObjectConfig(mongoConfigWithReplicaSet);
        const collectionConfig = CollectionConfig.fromConfig(config, "users", Maybe.just("testuser"));
        collectionConfig.caseOf({
            left: () => {
                throw new Error("Could not build config object");
            },
            right: colConfig => {
                const conConfig = colConfig.connectionConfig;
                const connString = conConfig.toConnectionString();
                expect(connString).toEqual(
                    "mongodb://testuser:testpassword@10.10.10.10:3333/bindersdb?authSource=admin&replicaSet=someReplicaSet"
                );
                expect(colConfig.collectionName).toEqual("users");
            }
        });
    });
});
