/* eslint-disable no-console */
import * as mongoose from "mongoose";
import { AccountIdentifier, AclIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { AclRepositoryFactory, MongoAclRepository } from "../../../src/authorization/repositories/acl";
import { AssigneeType, PermissionName, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Acl } from "../../../src/authorization/models/acl";
import { CollectionConfig } from "@binders/binders-service-common/lib/mongo/config";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ObjectConfig } from "@binders/client/lib/config/config";
import UUID from "@binders/client/lib/util/uuid";

function getFactory() {
    const collectionName = UUID.randomWithPrefix("acls-").toString();
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
                    database: "test",
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

    const config = new ObjectConfig(configData);
    const logger = LoggerBuilder.fromConfig(config);
    const collectionConfig = CollectionConfig.fromConfig(config, "acls").caseOf({
        left: error => {
            console.error(error);
            throw error;
        },
        right: collConfig => collConfig
    });
    return {
        factory: new AclRepositoryFactory(collectionConfig, logger),
        logger
    };
}

export interface Setup {
    repo: MongoAclRepository;
    cleanup(): Promise<void>;
}

export async function setup(): Promise<Setup> {
    const { factory, logger } = getFactory();
    const cleanup = async () => {
        await factory.drop();
        await mongoose.disconnect();
    }
    await factory.syncIndexes()
    return {
        cleanup,
        repo: factory.build(logger)
    };
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildAcl1() {
    return new Acl(
        AclIdentifier.generate(),
        "acl-name",
        "acl-desc",
        AccountIdentifier.generate(),
        [
            {
                type: AssigneeType.USER,
                ids: ["uid-123"]
            }
        ],
        [
            {
                resource: {
                    type: ResourceType.DOCUMENT,
                    ids: ["doc-id"]
                },
                permissions: [{ name: PermissionName.VIEW }]
            }
        ],
        "rol-123"
    );
}
