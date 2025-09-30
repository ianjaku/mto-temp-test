import * as mongoose from "mongoose";
import { Logger, LoggerBuilder } from "../util/logging";
import { MongoRepository, MongoRepositoryFactory } from "./repository";
import { CollectionConfig } from "./config";
import { Maybe } from "@binders/client/lib/monad";
import { ObjectConfig } from "@binders/client/lib/config/config";
import UUID from "@binders/client/lib/util/uuid";

function getTestFactory<T extends mongoose.Document>(collectionName: string, factoryBuilder: (config: CollectionConfig, logger: Logger) => Promise<MongoRepositoryFactory<T>>): Promise<{factory: MongoRepositoryFactory<T>, logger: Logger}> {
    const realCollectionName = UUID.randomWithPrefix("componenttest-").toString();
    const configData = {
        "mongo": {
            "clusters":  {
                "main": {
                    "instances": [
                        { "host": "127.0.0.1", "port": 27017}
                    ]
                }
            },
            "collections": { }
        },
        "logging": {
            "default": {
                "level": "TRACE"
            }
        }
    };
    configData["mongo"]["collections"][collectionName] = {
        "cluster": "main",
        "database": "test",
        "collection": realCollectionName
    };

    const config = new ObjectConfig(configData);
    const logger = LoggerBuilder.fromConfig(config);
    return CollectionConfig.promiseFromConfig(config, collectionName, Maybe.nothing<string>())
        .then( collectionConfig => {
            return factoryBuilder(collectionConfig, logger)
                .then( factory => {
                    return {
                        factory,
                        logger
                    };
                });
        });
}

export interface Setup<D extends mongoose.Document> {
    repo: MongoRepository<D>;
    cleanup(): Promise<void>;
}

export function setup<D extends mongoose.Document>(collectionAlias: string, builder: FactoryBuilder<D>): Promise<Setup<D>> {
    return getTestFactory<D>(collectionAlias, builder)
        .then( ({factory, logger}) => {
            const cleanup = () => factory.drop();
            return factory.syncIndexes()
                .then( () => {
                    const setup = {
                        cleanup,
                        repo: factory.build(logger)
                    };
                    return setup;
                });
        });
}

export interface FactoryBuilder<D extends mongoose.Document> {
    (config: CollectionConfig, logger: Logger): Promise<MongoRepositoryFactory<D>>;
}

export type TestCase<D extends mongoose.Document, C> = (repo: MongoRepository<D>) => Promise<C>;


function wrap<D extends mongoose.Document, C>(testCase: TestCase<D, C>): TestCase<D, C> {
    return function(repo: MongoRepository<D>): Promise<C> {
        try {
            return testCase(repo);
        }
        catch (error) {
            return Promise.reject(error);
        }
    };
}

export function runMongoTest<D extends mongoose.Document, C> (collectionAlias: string, builder: FactoryBuilder<D>, testCase: TestCase<D, C>): Promise<void> {
    return setup<D>(collectionAlias, builder)
        .then(env => {
            const repo = env.repo;
            return wrap(testCase) (repo)
                .then<void>(
                    () => env.cleanup(),
                    error => {
                        env.cleanup();
                        throw error;
                    }
                );
        });
}