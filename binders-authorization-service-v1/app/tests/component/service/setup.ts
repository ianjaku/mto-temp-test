import * as mongoose from "mongoose";
import { AuthorizationService, AuthorizationServiceFactory } from "../../../src/authorization/service";
import { EntityMapperFactory } from "../../../src/authorization/entitymapper";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ObjectConfig } from "@binders/client/lib/config/config";
import UUID from "@binders/client/lib/util/uuid";

export const constants = {
    ACCOUNT_1: "aid-account-1",
    ACCOUNT_2: "aid-account-2",
    USER_1: "uid-user-1",
    USER_2: "uid-user-2",
    USER_3: "uid-user-3",
    COLLECTION_1: "col-1",
    COLLECTION_2: "col-2",
    DOCUMENT_1: "doc-1",
    DOCUMENT_2: "doc-2",
    DOCUMENT_3: "doc-3",
    GROUP_1: "gid-1",
    GROUP_2: "gid-2"
};

function getConfig() {
    const collectionName = UUID.randomWithPrefix("acl-");
    const configData = {
        mongo: {
            clusters: {
                main: {
                    instances: [{ host: "127.0.0.1", port: 27017 }]
                }
            },
            collections: {
                acls: {
                    cluster: "main",
                    database: "componenttest",
                    collection: collectionName
                }
            }
        },
        logging: {
            default: {
                level: "DEBUG"
            }
        }
    };

    return new ObjectConfig(configData);
}
export interface TestSetup {
    cleanup(): Promise<void>;
    service: AuthorizationService;
}

export async function setup(mapperOverride?: EntityMapperFactory): Promise<TestSetup> {
    const config = getConfig();
    const serviceFactory = await AuthorizationServiceFactory.fromConfig(config, mapperOverride)
    const repoFactory = serviceFactory.getRepoFactory();
    await repoFactory.syncIndexes()
    const service = await serviceFactory.forRequest({ logger: LoggerBuilder.fromConfig(config) });
    return {
        service,
        cleanup: async () => {
            await repoFactory.drop();
            await mongoose.disconnect();
        }
    };
}
