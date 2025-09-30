import {
    AggregatorType,
    IAccountAggregationReport,
    IAggregationReport
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { buildChooseLanguageEvent } from "../../helpers/eventLogging";

/*

test strategy:

1/ no events found:

Log a choose language event
Aggregate all
-> expect toAddCount of 1
Aggregate all again
-> expect toAddCount of 0
Log a choose language event
Aggregate all again
-> expect toAddCount of 1

2/ Iterrupted aggregation:

?

*/

describe("Aggregations; exceptions", () => {

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

    let trackingClient: TrackingServiceClient;
    let accountId;
    let publicationId;


    beforeAll(async () => {
        trackingClient = await trackingClientFactory.createBackend();
        const repoClient = await repoClientFactory.createBackend();
        await globalFixtures.withFreshAccount(async (fixtures) => {
            accountId = fixtures.getAccountId();
            const binder = await fixtures.items.createDocument({
                title: "A document",
                languageCode: "en",
            }, { addToRoot: true })
            const [publication] = await repoClient.publish(binder.id, ["en"]);
            publicationId = publication.id;
        });
    });

    test("No events found", async () => {
        await trackingClient.log([buildChooseLanguageEvent(accountId, "en", publicationId)], userId, true);
        const aggregationReport1: IAggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                aggregatorTypes: [AggregatorType.CHOOSELANGUAGE],
            }
        );
        const accountAggregationReport1 = aggregationReport1[accountId] as IAccountAggregationReport;
        expect(accountAggregationReport1.aggregatorReports[AggregatorType.CHOOSELANGUAGE].toAddCount).toBe(1);
        expect(accountAggregationReport1.aggregatorReports[AggregatorType.CHOOSELANGUAGE].toCompleteCount).toBeFalsy();

        const aggregationReport2: IAggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                aggregatorTypes: [AggregatorType.CHOOSELANGUAGE],
            }
        );
        const accountAggregationReport2 = aggregationReport2[accountId] as IAccountAggregationReport;
        expect(accountAggregationReport2.aggregatorReports[AggregatorType.CHOOSELANGUAGE].toAddCount).toBeFalsy();
        expect(accountAggregationReport2.aggregatorReports[AggregatorType.CHOOSELANGUAGE].toCompleteCount).toBeFalsy();

        await trackingClient.log([buildChooseLanguageEvent(accountId, "en", publicationId)], userId, true);

        setTimeout(async () => {
            const aggregationReport3: IAggregationReport = await trackingClient.aggregateUserEvents(
                [accountId],
                {
                    aggregatorTypes: [AggregatorType.CHOOSELANGUAGE],
                }
            );
            const accountAggregationReport3 = aggregationReport3[accountId] as IAccountAggregationReport;
            expect(accountAggregationReport3.aggregatorReports[AggregatorType.CHOOSELANGUAGE].toAddCount).toBe(1);
            expect(accountAggregationReport3.aggregatorReports[AggregatorType.CHOOSELANGUAGE].toCompleteCount).toBeFalsy();
        }, 2000);

    });
});
