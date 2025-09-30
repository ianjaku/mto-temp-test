/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    AggregatorType,
    Event,
    EventType,
    IAccountAggregationReport,
    IAggregationReport,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { buildChunkBrowsedEvent, buildEvent } from "../../helpers/eventLogging";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";

/*

test strategy:
    preparation:
    Log events for 3 read sessions

    Aggregate so first read session is covered
    -> expect 1 read session useraction

    Aggregate so second and half of third read session are covered
    -> expect 2 read session useractions, one of them incomplete (since lacking document closed event)

    Aggregate the rest
    -> test working of toComplete
    -> expect 3 read session useractions, all complete
*/

describe("aggregation of read sessions", () => {

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

    const userId = "uid-123";

    function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    let trackingClient: TrackingServiceClient;
    let accountId;
    let endOfThirdSession: number;
    const publicationIds: string[] = [];

    beforeAll(async () => {
        trackingClient = await trackingClientFactory.createBackend();
        const repoClient = await repoClientFactory.createBackend();
        await globalFixtures.withFreshAccount(async (fixtures) => {
            accountId = fixtures.getAccountId();
            for (const i of [1, 2, 3]) {

                const title = `Document ${i}`;

                const binder = await fixtures.items.createDocument({
                    title,
                    chunkTexts: ["A", "manual consisting", "of three chunks"],
                    languageCode: "en",
                }, { addToRoot: true })
                const [publication] = await repoClient.publish(binder.id, ["en"]);

                publicationIds[i - 1] = publication.id;

                const sessionId = `sess-${i}`;
                await trackingClient.log([buildEvent(EventType.DOCUMENT_OPENED, accountId, binder.id, publication.id, title, sessionId)], userId, true);
                await trackingClient.log([buildChunkBrowsedEvent(accountId, 0, 1, sessionId, binder.id, publication.id, 3000)], userId, true);
                await trackingClient.log([buildChunkBrowsedEvent(accountId, 1, 2, sessionId, binder.id, publication.id, 1200)], userId, true);
                await sleep(1000); // make sure the read session is > 1 second, otherwise it's ignored by the aggregation
                await trackingClient.log([buildChunkBrowsedEvent(accountId, 2, 2, sessionId, binder.id, publication.id, 6200)], userId, true);
                await trackingClient.log([buildEvent(EventType.DOCUMENT_CLOSED, accountId, binder.id, publication.id, title, sessionId)], userId, true);
            }
        });
    });

    test("Read session aggregation 1; should produce 1 useraction", async () => {
        const aggregationReport: IAggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                limitNumberOfEvents: 5, // just enough for first read session
                aggregatorTypes: [AggregatorType.READSESSIONS],
            }
        );

        const accountAggregationReport = aggregationReport[accountId] as IAccountAggregationReport;
        expect(accountAggregationReport.aggregatorReports[AggregatorType.READSESSIONS].toAddCount).toBe(1);
        expect(accountAggregationReport.aggregatorReports[AggregatorType.READSESSIONS].toCompleteCount).toBeFalsy();

        await sleep(2000);
        const findResult = await trackingClient.findUserActions({
            accountId,
            userActionTypes: [UserActionType.DOCUMENT_READ],
        });
        const userActions = findResult.userActions;
        expect(userActions.length).toBe(1);
        const userAction = userActions[0];

        const chunkTimingsMapRaw = userAction.data["chunkTimingsMap"];
        expect(chunkTimingsMapRaw).toBeTruthy();
        const chunkTimingsMap = JSON.parse(chunkTimingsMapRaw);
        expect(Object.keys(chunkTimingsMap).length).toBe(3);
        expect(chunkTimingsMap["0"].wordCount).toBe(1);
        expect(chunkTimingsMap["0"].timeSpentMs).toBe(3000);
        expect(chunkTimingsMap["1"].wordCount).toBe(2);
        expect(chunkTimingsMap["1"].timeSpentMs).toBe(1200);
        expect(chunkTimingsMap["2"].wordCount).toBe(3);
        expect(chunkTimingsMap["2"].timeSpentMs).toBe(6200);

    });

    test("Read session aggregation 2; should produce 1 complete and one incomplete useraction", async () => {
        const aggregationReport: IAggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                limitNumberOfEvents: 7, // Aggregate one and a half read sessions
                aggregatorTypes: [AggregatorType.READSESSIONS],
            }
        );
        const accountAggregationReport = aggregationReport[accountId] as IAccountAggregationReport;
        expect(accountAggregationReport.aggregatorReports[AggregatorType.READSESSIONS].toAddCount).toBe(2);
        expect(accountAggregationReport.aggregatorReports[AggregatorType.READSESSIONS].toCompleteCount).toBeFalsy();

        await sleep(2000);
        const findResult = await trackingClient.findUserActions({
            accountId,
            userActionTypes: [UserActionType.DOCUMENT_READ],
        });
        const userActions = findResult.userActions;
        expect(userActions.length).toBe(3);

        const doc2UserAction = userActions.find((ua) => ua.data["publicationId"] === publicationIds[1]);
        expect(doc2UserAction.data["incomplete"]).toBeFalsy();
        const doc3UserAction = userActions.find((ua) => ua.data["publicationId"] === publicationIds[2]);
        expect(doc3UserAction.data["incomplete"]).toBe(true);
        endOfThirdSession = new Date(doc3UserAction.end).getTime();
    });

    test("Read session aggregation 2; should produce the rest of the third useraction in 'to complete'", async () => {
        const aggregationReport: IAggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                aggregatorTypes: [AggregatorType.READSESSIONS],
            }
        );
        const accountAggregationReport = aggregationReport[accountId] as IAccountAggregationReport;
        expect(accountAggregationReport.aggregatorReports[AggregatorType.READSESSIONS].toAddCount).toBe(0);
        expect(accountAggregationReport.aggregatorReports[AggregatorType.READSESSIONS].toCompleteCount).toBe(1);

        await sleep(2000);
        const findResult = await trackingClient.findUserActions({
            accountId,
            userActionTypes: [UserActionType.DOCUMENT_READ],
        });
        const userActions = findResult.userActions;
        expect(userActions.length).toBe(3);
        const thirdUserAction = userActions.find((ua) => ua.data["publicationId"] === publicationIds[2]);
        expect(thirdUserAction.data["incomplete"]).toBeFalsy();
        expect(new Date(thirdUserAction.end).getTime()).toBeGreaterThan(endOfThirdSession);
    });


});
