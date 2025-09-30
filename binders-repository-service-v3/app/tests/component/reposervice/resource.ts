import * as mongoose from "mongoose";
import { BindersRepositoryService } from "../../../src/repositoryservice/service";
import { BindersRepositoryServiceFactory } from ".././../../src/repositoryservice/service";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ObjectConfig } from "@binders/client/lib/config/config";

const DOCUMENT_ID = "AVlgaf52gRcJXleWPhg9";
const COLLECTION_ID = "AVqTseatgRcJXleWPhvl";
const ACCOUNT_ID = "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6";

const configData = {
    "mongo": {
        "clusters":  {
            "main": {
                "instances": [
                    { "host": "dockerhost", "port": 27017}
                ]
            }
        },
        "collections": {
            "domainfilters": {
                "cluster": "main",
                "database": "routing_service",
                "collection": "domainfilters"
            }
        }
    },
    "elasticsearch": {
        "clusters": {
            "binders": {
                "host": "http://dockerhost:9200",
                "apiVersion": "2.4",
                "sniffOnStart": false
            }
        }
    },
    logging: {
        default: {
            level: "TRACE"
        }
    },
    "redis": {
        "documents": {
            "host": "localhost",
            "port": 6379
        }
    },
    "services": {
        "binders": {
            "prefix": "/binders",
            "location": "http://localhost:8008"
        },
        "routing": {
            "prefix": "/routing",
            "location": "http://localhost:8008"
        }
    },
    "session": {
        "store": {
            "type": "redis",
            "server": {
                "host": "redis",
                "port": 6379
            }
        },
        "secret": "JEaLdpbUqsc92dmeMudK",
        "maxAge": 900000
    }
};

const config = new ObjectConfig(configData);

interface Setup {
    service: BindersRepositoryService;
    cleanup(): Promise<void>;
}

function setup(): Promise<Setup> {
    const logger = LoggerBuilder.fromConfig(config);
    return BindersRepositoryServiceFactory.fromConfig(config)
        .then(factory => {
            return {
                service: factory.forRequest({logger}),
                cleanup() {
                    mongoose.disconnect();
                    return factory.shutdown().then(() => undefined);
                }
            };
        });
}

test("get document resources correctly for a document", () => {
    return setup()
        .then(context => {
            return context.service.getDocumentResourceDetails(DOCUMENT_ID)
                .then(details => {
                    expect(details.id).toEqual(DOCUMENT_ID);
                    expect(details.accountId).toEqual(ACCOUNT_ID);
                    expect(Object.keys(details.ancestorDocuments).indexOf(DOCUMENT_ID)).not.toEqual(-1);
                })
                .then( () => context.cleanup())
                .catch( error => {
                    context.cleanup();
                    throw error;
                });
        });
});

test("get document resources correctly for a collection", () => {
    return setup()
        .then(context => {
            return context.service.getDocumentResourceDetails(COLLECTION_ID)
                .then(details => {
                    expect(details.id).toEqual(COLLECTION_ID);
                    expect(details.accountId).toEqual(ACCOUNT_ID);
                    expect(Object.keys(details.ancestorDocuments).indexOf(COLLECTION_ID)).not.toEqual(-1);
                })
                .then( () => context.cleanup())
                .catch( error => {
                    context.cleanup();
                    throw error;
                });
        });
});