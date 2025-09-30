import {
    AggregatorType,
    EventType,
    UserActionType
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

describe("", () => {
    test("", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();
            const repoClient = await repoClientFactory.createBackend();
            const backendTrackingClient = await trackingClientFactory.createBackend();
            const trackingClient = await trackingClientFactory.createBackend(() => accountId);// .createForFrontend(userId);
            const documentTitle = "Document";
            const binder = await fixtures.items.createDocument({
                title: documentTitle,
                chunkTexts: ["A", "manual consisting", "of three chunks"],
                languageCode: "en",
            }, { addToRoot: true })
            const [publication] = await repoClient.publish(binder.id, ["en"]);

            const { userActions: userActionsBeforeRead } = await backendTrackingClient.searchUserActions({
                accountId,
                userIds: [],
                itemIds: [binder.id],
                userActionTypes: [UserActionType.NOT_READ],
            });

            const publicReadAction = userActionsBeforeRead.find((action) => action.userDisplayName === "public");
            expect(publicReadAction).toBeDefined();
            expect(publicReadAction.timestamp).toBeUndefined();

            const sessionId = `sess-${Date.now()}`;
            await trackingClient.log([buildEvent(EventType.DOCUMENT_OPENED, accountId, binder.id, publication.id, documentTitle, sessionId)]);
            await trackingClient.log([buildChunkBrowsedEvent(accountId, 0, 1, sessionId, binder.id, publication.id, 500)]);
            await trackingClient.log([buildChunkBrowsedEvent(accountId, 1, 2, sessionId, binder.id, publication.id, 500)]);
            await trackingClient.log([buildChunkBrowsedEvent(accountId, 2, 2, sessionId, binder.id, publication.id, 500)]);
            // make sure the read session is > 1 second, otherwise it's ignored by the aggregation
            await new Promise(resolve => setTimeout(resolve, secondsToMilliseconds(1)));
            await trackingClient.log([buildEvent(EventType.DOCUMENT_CLOSED, accountId, binder.id, publication.id, documentTitle, sessionId)]);
            await backendTrackingClient.aggregateUserEvents([accountId], { aggregatorTypes: [AggregatorType.READSESSIONS] });

            const { userActions: userActionsAfterRead } = await backendTrackingClient.searchUserActions({
                accountId,
                itemIds: [binder.id],
                userIds: [],
                userActionTypes: [UserActionType.NOT_READ],
            });

            // the public user has read the document, the NOT_READ action should be gone
            expect(userActionsAfterRead).not.toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        userDisplayName: "public",
                    }),
                ])
            );

        });
    });
});
