/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    AggregatorType,
    Event,
    EventType,
    IAccountAggregationReport,
    IAggregationReport,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { buildChunkBrowsedEvent, buildEvent, buildRelabelLanguageEvent } from "../../helpers/eventLogging";
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
    Log events for 1 read session, and aggregate read session
    Log a relabel language event

    Aggregate relabel language
    -> expect a read session in the toCompletes
    -> expect single read session in the end with the new language code
*/

describe("aggregation of relabel events", () => {

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

    const fromLanguageCode = "en";
    const toLanguageCode = "fr";
    let trackingClient: TrackingServiceClient;
    let accountId;

    beforeAll(async () => {
        trackingClient = await trackingClientFactory.createBackend();
        const repoClient = await repoClientFactory.createBackend();
        await globalFixtures.withFreshAccount(async (fixtures) => {
            accountId = fixtures.getAccountId();
            const title = "Some document";
            const binder = await fixtures.items.createDocument({
                title,
                chunkTexts: ["A", "manual consisting", "of three chunks"],
                languageCode: fromLanguageCode,
            }, { addToRoot: true })
            const [publication] = await repoClient.publish(binder.id, ["en"]);

            const sessionId = "sess";
            await trackingClient.log([buildEvent(EventType.DOCUMENT_OPENED, accountId, binder.id, publication.id, title, sessionId)], userId, true);
            await trackingClient.log([buildChunkBrowsedEvent(accountId, 0, 1, sessionId, binder.id, publication.id, 3000)], userId, true);
            await trackingClient.log([buildChunkBrowsedEvent(accountId, 1, 2, sessionId, binder.id, publication.id, 1200)], userId, true);
            await sleep(1000); // make sure the read session is > 1 second, otherwise it's ignored by the aggregation
            await trackingClient.log([buildChunkBrowsedEvent(accountId, 2, 2, sessionId, binder.id, publication.id, 6200)], userId, true);
            await trackingClient.log([buildEvent(EventType.DOCUMENT_CLOSED, accountId, binder.id, publication.id, title, sessionId)], userId, true);
            await trackingClient.aggregateUserEvents(
                [accountId],
                {
                    limitNumberOfEvents: 5,
                    aggregatorTypes: [AggregatorType.READSESSIONS],
                }
            );
            await trackingClient.log([buildRelabelLanguageEvent(
                accountId,
                fromLanguageCode,
                toLanguageCode,
                binder.id
            )], userId, true);
        });
    });

    test("Relabel languages aggregation 1; should produce 1 tocomplete useraction", async () => {

        await sleep(2000);
        const userActionsPre = await trackingClient.findUserActions({ accountId, userActionTypes: [UserActionType.DOCUMENT_READ] });
        expect(userActionsPre).toHaveLength(1);
        expect(userActionsPre[0].data.itemLanguage).toBe(fromLanguageCode);

        const aggregationReport: IAggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                aggregatorTypes: [AggregatorType.RELABELLANGUAGE],
            }
        );

        await sleep(2000);
        const accountAggregationReport = aggregationReport[accountId] as IAccountAggregationReport;
        expect(accountAggregationReport.aggregatorReports[AggregatorType.RELABELLANGUAGE].toAddCount).toBe(0);
        expect(accountAggregationReport.aggregatorReports[AggregatorType.RELABELLANGUAGE].toCompleteCount).toBe(1);

        const userActionsPost = await trackingClient.findUserActions({ accountId, userActionTypes: [UserActionType.DOCUMENT_READ] });
        expect(userActionsPost).toHaveLength(1);
        expect(userActionsPost[0].data.itemLanguage).toBe(toLanguageCode);

    });
});
