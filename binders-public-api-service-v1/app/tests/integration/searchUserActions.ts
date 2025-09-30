/* eslint-disable @typescript-eslint/no-unused-vars */
import { AggregatorType, EventType, UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { ONE_MINUTE, ONE_SECOND, ONE_YEAR } from "@binders/client/lib/util/time";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { PublicApiServiceClient } from "@binders/client/lib/clients/publicapiservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    PublicApiServiceClient,
    "v1"
);
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

describe("searchUserActions", () => {

    it("rejects requests without date filters", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const accountId = fixtures.getAccountId();
            const user = await fixtures.users.createAdmin();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            await expect(client.searchUserActions({ accountId })).rejects.toThrow(/Date filter is missing/);
        });
    });

    it("rejects requests without user action type filter", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const accountId = fixtures.getAccountId();
            const user = await fixtures.users.createAdmin();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            await expect(client.searchUserActions({
                accountId,
                startUtcTimestamp: 10,
                endUtcTimestamp: 20,
            })).rejects.toThrow(/User action type filter is missing/);
        });
    });

    it("rejects requests with wide date filter", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const accountId = fixtures.getAccountId();
            const user = await fixtures.users.createAdmin();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            await expect(client.searchUserActions({
                accountId,
                startUtcTimestamp: 10,
                endUtcTimestamp: 10 + ONE_YEAR + 1,
            })).rejects.toThrow(/Date filter is too wide/);
        });
    });

    it("rejects requests with invalid date filter", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const accountId = fixtures.getAccountId();
            const user = await fixtures.users.createAdmin();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            await expect(client.searchUserActions({
                accountId,
                endUtcTimestamp: 10,
                startUtcTimestamp: 10 + ONE_YEAR + 1,
            })).rejects.toThrow(/Date filter is invalid/);
        });
    });

    it("returns user actions", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const accountId = fixtures.getAccountId();
            const readUser = await fixtures.users.create();
            const admin = await fixtures.users.createAdmin();

            const documentTitle = "Foo Bar";
            const binder = await fixtures.items.createDocument({
                title: documentTitle,
                chunkTexts: ["Hello", "World"],
                languageCode: "en",
            }, { addToRoot: true })
            const repoClient = await repoClientFactory.createBackend();
            const [publication] = await repoClient.publish(binder.id, ["en"]);

            const trackingClient = await trackingClientFactory.createForFrontend(readUser.id);
            const sessionStart = Date.now() - 10 * ONE_MINUTE;
            const sessionId = `sess-${sessionStart}`;

            async function logUserEvent({ eventType, occurrenceMsDiff }: { eventType: EventType, occurrenceMsDiff: number }) {
                await trackingClient.log([{
                    eventType,
                    accountId,
                    data: {
                        binderId: binder.id,
                        documentId: publication.id,
                        documentType: "publication",
                        sessionId,
                        title: documentTitle,
                        path: "/",
                    },
                    occurrenceMsDiff,
                }], readUser.id);
            }

            await logUserEvent({ eventType: EventType.DOCUMENT_OPENED, occurrenceMsDiff: 6 * ONE_MINUTE });
            await logUserEvent({ eventType: EventType.READ_SESSION_FOCUS, occurrenceMsDiff: 5 * ONE_MINUTE });
            await logUserEvent({ eventType: EventType.CHUNK_BROWSED, occurrenceMsDiff: ONE_MINUTE + 2 * ONE_SECOND });
            await logUserEvent({ eventType: EventType.READ_SESSION_BLUR, occurrenceMsDiff: ONE_MINUTE + ONE_SECOND });
            await logUserEvent({ eventType: EventType.DOCUMENT_CLOSED, occurrenceMsDiff: ONE_MINUTE });

            const backendTrackingClient = await trackingClientFactory.createBackend();
            await backendTrackingClient.aggregateUserEvents([accountId], {
                rangeOverride: {
                    rangeStart: new Date(sessionStart),
                    rangeEnd: new Date(),
                },
                aggregatorTypes: [AggregatorType.READSESSIONS],
            });

            const client = await clientFactory.createForPublicApi(admin.id, fixtures.getAccountId());
            const result = await client.searchUserActions({
                accountId,
                startUtcTimestamp: sessionStart,
                endUtcTimestamp: Date.now(),
                userActionTypes: [UserActionType.DOCUMENT_READ],
            });
            expect(result.length).toBe(1);
            expect(result.at(0).userActionName).toEqual("Read Document");
        });
    });

});

