import {
    AggregatorType,
    EventType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { buildChunkBrowsedEvent, buildEvent } from "../helpers/eventLogging";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { secondsToMilliseconds } from "date-fns";
import { zipWith } from "ramda";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const trackingClientFactory = new ClientFactory(
    config,
    TrackingServiceClient,
    "v1"
);

const repoClientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);

const FIRST_READ_SESSION_TIMINGS = [3000, 1200, 6200] as const;
const SECOND_READ_SESSION_TIMINGS = [6000, 3200, 2200] as const;
const AVERAGE_READ_SESSION_TIMINGS = zipWith((left, right) => (left + right) / 2, FIRST_READ_SESSION_TIMINGS, SECOND_READ_SESSION_TIMINGS);

describe("aggregation of read sessions", () => {
    test("Read session aggregation 1; should produce 1 useraction", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();
            const { id: userId } = await fixtures.users.createAdmin();
            const repoClient = await repoClientFactory.createBackend();
            const backendTrackingClient = await trackingClientFactory.createBackend();
            const trackingClient = await trackingClientFactory.createForFrontend(userId);

            const documentTitle = "Document";
            const binder = await fixtures.items.createDocument({
                title: documentTitle,
                chunkTexts: ["A", "manual consisting", "of three chunks"],
                languageCode: "en",
            }, { addToRoot: true })
            const [publication] = await repoClient.publish(binder.id, ["en"]);

            const createReadEvents = async (chunkTimings: readonly [number, number, number]) => {
                const sessionId = `sess-${Date.now()}`;
                await trackingClient.log([buildEvent(EventType.DOCUMENT_OPENED, accountId, binder.id, publication.id, documentTitle, sessionId)], userId);
                await trackingClient.log([buildChunkBrowsedEvent(accountId, 0, 1, sessionId, binder.id, publication.id, chunkTimings[0])], userId);
                await trackingClient.log([buildChunkBrowsedEvent(accountId, 1, 2, sessionId, binder.id, publication.id, chunkTimings[1])], userId);
                await trackingClient.log([buildChunkBrowsedEvent(accountId, 2, 2, sessionId, binder.id, publication.id, chunkTimings[2])], userId);
                // make sure the read session is > 1 second, otherwise it's ignored by the aggregation
                await new Promise(resolve => setTimeout(resolve, secondsToMilliseconds(1)));
                await trackingClient.log([buildEvent(EventType.DOCUMENT_CLOSED, accountId, binder.id, publication.id, documentTitle, sessionId)], userId);
            }
            await createReadEvents(FIRST_READ_SESSION_TIMINGS);
            await createReadEvents(SECOND_READ_SESSION_TIMINGS);

            await backendTrackingClient.aggregateUserEvents([accountId], { aggregatorTypes: [AggregatorType.READSESSIONS] });

            const { chunkTimings } = await backendTrackingClient.allBinderStatistics(binder.id, {}, accountId);
            expect(chunkTimings[publication.id]["0"].timeSpentMs).toBe(AVERAGE_READ_SESSION_TIMINGS[0]);
            expect(chunkTimings[publication.id]["1"].timeSpentMs).toBe(AVERAGE_READ_SESSION_TIMINGS[1]);
            expect(chunkTimings[publication.id]["2"].timeSpentMs).toBe(AVERAGE_READ_SESSION_TIMINGS[2]);
        });
    });
});
