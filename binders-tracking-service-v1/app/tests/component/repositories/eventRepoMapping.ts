import * as mongoose from "mongoose";
import {
    MongoEventRepoMappingRepository,
    MongoEventRepoMappingRepositoryFactory
} from "../../../src/trackingservice/repositories/eventRepoMappingRepository";
import { EventRepoMapping } from "../../../src/trackingservice/models/eventRepoMapping";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ObjectConfig } from "@binders/client/lib/config/config";
import UUID from "@binders/client/lib/util/uuid";
import moment from "moment";

const collectionName = "componenttest-tracking_service-eventRepoMappings-" + UUID.random().toString();

const xDaysAgo = (n: number) => moment().subtract(n, "days").toDate();

const config = new ObjectConfig({
    mongo: {
        clusters: {
            main: {
                instances: [{ host: "10.106.111.61", port: 27017 }]
            }
        },
        collections: {
            eventRepoMapping: {
                cluster: "main",
                database: "test",
                collection: collectionName
            }
        }
    },
    session: {
        secret: "fake"
    },
    logging: {
        default: {
            level: "TRACE"
        }
    }
});

interface Context {
    factory: MongoEventRepoMappingRepositoryFactory;
    repository: MongoEventRepoMappingRepository;
    cleanup(): Promise<void>;
}

async function getContext(): Promise<Context> {
    const logger = LoggerBuilder.fromConfig(config);
    const factory = await MongoEventRepoMappingRepositoryFactory.fromConfig(config, logger);
    const cleanup = async () => {
        await factory.drop();
        await mongoose.disconnect();
    }
    return {
        factory,
        repository: factory.build(logger),
        cleanup
    };
}

let context;

describe("eventRepoMapping repository", () => {
    it("should insert eventRepoMappings", async () => {
        try {
            context = await getContext();
            const repo = context.repository;
            const dummyCollectionName1 = `TEST-collectionName-${UUID.random().toString()}1`;
            const dummyCollectionName2 = `TEST-collectionName-${UUID.random().toString()}2`;
            await repo.insertEventRepoMapping(new EventRepoMapping(dummyCollectionName1, xDaysAgo(5), xDaysAgo(3)));
            await repo.insertEventRepoMapping(new EventRepoMapping(dummyCollectionName2, xDaysAgo(2), xDaysAgo(0)));
            const [colName1] = await repo.eventReposForTimestamp(xDaysAgo(4));
            const [colName2] = await repo.eventReposForTimestamp(xDaysAgo(1));
            expect(colName1).toEqual(dummyCollectionName1);
            expect(colName2).toEqual(dummyCollectionName2);
            return context.cleanup();
        }
        catch(e) {
            await context.cleanup();
            throw e;
        }
    });
});

