import {
    AggregatorType,
    EventPayload,
    EventType,
    IAccountAggregationReport,
    IAggregationReport,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";

/*

test strategy:

event   first agg   second agg  third agg   fourth agg  <insert CRE 4 event>  fifth arg;DEL-scope    fifth agg;CRE-scope

CRE 1   x
EDT 1   x
EDT 1   x
DEL 1   x
CRE 2   x
EDT 2               x
EDT 2               x
DEL 2   x
CRE 3               x
EDT 3                           x
EDT 3                           x
DEL 3               x
CRE 4                                                                                                 x
        5 actions   3 actions   1 action                                                              1 action

v test toAdds, resulting useractions
v test if aggregations start where last one dropped off

test interrupted aggregations

event hash: accountId-eventType-userId-timestamp
useraction hash: accountId-useractiontype-userId-start-end

*/


describe("aggregation of item CRUD events", () => {

    const config = BindersConfig.get();
    const globalFixtures = new TestFixtures(config);
    const trackingClientFactory = new ClientFactory(
        config,
        TrackingServiceClient,
        "v1"
    );

    const userId = "uid-123";

    function buildEventData(
        eventType: EventType,
        i: number,
    ) {
        if (eventType === EventType.ITEM_CREATED || eventType === EventType.ITEM_DELETED) {
            return {
                itemId: `item-${i}`,
                itemKind: "binder",
                itemTitle: `item ${i}`
            };
        }
        if (eventType === EventType.BINDER_EDITED) {
            return {
                binderId: `item-${i}`,
                itemId: `item-${i}`,
                itemKind: "binder",
                start: new Date().toISOString(),
                userId,
                itemTitle: `item ${i}`,
                isoCode: "nl",
                end: new Date().toISOString(),
                sessionId: `session-${i}`,
            };
        }
        throw new Error("unknown event type");
    }

    function buildEvent(
        eventType: EventType,
        accountId: string,
        i: number,
    ): EventPayload {
        return {
            eventType,
            accountId,
            data: buildEventData(eventType, i),
        }
    }

    function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function inspectAccountAggregationReport(
        accountAggregationReport: IAccountAggregationReport,
        expecteds: {
            expectedCreations: number,
            expectedEdits: number,
            expectedDeletes: number,
        },
    ) {
        const { expectedCreations, expectedEdits, expectedDeletes } = expecteds;
        expect(accountAggregationReport.aggregatorReports[AggregatorType.ITEMCREATIONS].toAddCount).toBe(expectedCreations);
        expect(accountAggregationReport.aggregatorReports[AggregatorType.ITEMEDITED].toAddCount).toBe(expectedEdits);
        expect(accountAggregationReport.aggregatorReports[AggregatorType.ITEMDELETIONS].toAddCount).toBe(expectedDeletes);
        expect(accountAggregationReport.aggregatorReports[AggregatorType.ITEMCREATIONS].toCompleteCount).toBeFalsy();
        expect(accountAggregationReport.aggregatorReports[AggregatorType.ITEMEDITED].toCompleteCount).toBeFalsy();
        expect(accountAggregationReport.aggregatorReports[AggregatorType.ITEMDELETIONS].toCompleteCount).toBeFalsy();

    }

    let trackingClient: TrackingServiceClient;
    let accountId;
    let lastEventTimestampsMap: Record<AggregatorType, number>;

    beforeAll(async () => {
        trackingClient = await trackingClientFactory.createBackend();
        await globalFixtures.withFreshAccount(async (fixtures) => {
            accountId = fixtures.getAccountId();
            // log a create, 2 edits and a delete event, for 3 items
            for (const i of [1, 2, 3]) {
                for (const eventType of [EventType.ITEM_CREATED, EventType.BINDER_EDITED, EventType.BINDER_EDITED, EventType.ITEM_DELETED]) {
                    await trackingClient.log([buildEvent(eventType, accountId, i)], userId, true);
                }
            }
        });

    });

    test("Crud aggregation 1; should produce 5 useractions", async () => {
        const aggregationReport: IAggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                limitNumberOfEvents: 2,
                aggregatorTypes: [AggregatorType.ITEMCREATIONS, AggregatorType.ITEMEDITED, AggregatorType.ITEMDELETIONS],
            }
        );

        const accountAggregationReport = aggregationReport[accountId] as IAccountAggregationReport;

        inspectAccountAggregationReport(accountAggregationReport, { expectedCreations: 2, expectedEdits: 1, expectedDeletes: 2 }); // the two edits it found combined into a single edit useraction session

        lastEventTimestampsMap = Object.keys(accountAggregationReport.aggregatorReports).reduce((acc, aggregatorType) => {
            acc[aggregatorType] = accountAggregationReport.aggregatorReports[aggregatorType].lastEventTimestamp;
            return acc;
        }, {} as Record<AggregatorType, number>);

        await sleep(2000);
        const findResult = await trackingClient.findUserActions({
            accountId,
            userActionTypes: [
                UserActionType.ITEM_CREATED,
                UserActionType.ITEM_EDITED,
                UserActionType.ITEM_DELETED,
            ],
        });
        const userActions = findResult.userActions;

        // verify CREATED EDITED and DELETEDs have been aggregated into useractions
        expect(userActions.length).toBe(5);
        const itemCreatedCount = userActions.filter(ua => ua.userActionType === UserActionType.ITEM_CREATED).length;
        expect(itemCreatedCount).toBe(2);
        const itemEditedCount = userActions.filter(ua => ua.userActionType === UserActionType.ITEM_EDITED).length;
        expect(itemEditedCount).toBe(1);
        const itemDeletedCount = userActions.filter(ua => ua.userActionType === UserActionType.ITEM_DELETED).length;
        expect(itemDeletedCount).toBe(2);
        // verify the aggregation has been logged
        const lastAggregationTime = await trackingClient.lastUserActionsAggregationTime(accountId);
        expect(lastAggregationTime).not.toBeFalsy();
    });

    test("Crud aggregation 2; should produce 3 useractions", async () => {
        const aggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                limitNumberOfEvents: 2,
                aggregatorTypes: [AggregatorType.ITEMCREATIONS, AggregatorType.ITEMEDITED, AggregatorType.ITEMDELETIONS],
            }
        );

        const accountAggregationReport = aggregationReport[accountId] as IAccountAggregationReport;
        inspectAccountAggregationReport(accountAggregationReport, { expectedCreations: 1, expectedEdits: 1, expectedDeletes: 1 });

        expect(accountAggregationReport.aggregatorReports[AggregatorType.ITEMCREATIONS].rangeUsed.rangeStart).toBe(
            lastEventTimestampsMap[AggregatorType.ITEMCREATIONS]
        );
        expect(accountAggregationReport.aggregatorReports[AggregatorType.ITEMEDITED].rangeUsed.rangeStart).toBe(
            lastEventTimestampsMap[AggregatorType.ITEMEDITED]
        );
        expect(accountAggregationReport.aggregatorReports[AggregatorType.ITEMDELETIONS].rangeUsed.rangeStart).toBe(
            lastEventTimestampsMap[AggregatorType.ITEMDELETIONS]
        );

    });

    test("Crud aggregation 3; should produce 1 useraction", async () => {
        const aggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                limitNumberOfEvents: 2,
                aggregatorTypes: [AggregatorType.ITEMCREATIONS, AggregatorType.ITEMEDITED, AggregatorType.ITEMDELETIONS],
            }
        );

        const accountAggregationReport = aggregationReport[accountId] as IAccountAggregationReport;
        inspectAccountAggregationReport(accountAggregationReport, { expectedCreations: 0, expectedEdits: 1, expectedDeletes: 0 });

    });

    test("Crud aggregation 4; shouldn't produce any useraction", async () => {
        const aggregationReport = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                limitNumberOfEvents: 2,
                aggregatorTypes: [AggregatorType.ITEMCREATIONS, AggregatorType.ITEMEDITED, AggregatorType.ITEMDELETIONS],
            }
        );
        const accountAggregationReport = aggregationReport[accountId] as IAccountAggregationReport;
        inspectAccountAggregationReport(accountAggregationReport, { expectedCreations: 0, expectedEdits: 0, expectedDeletes: 0 });

    });

    test("Insert an ITEM_CREATED event, then perform two more aggregations", async () => {
        await trackingClient.log([buildEvent(EventType.ITEM_CREATED, accountId, 4)], userId, true);
        const aggregationReport1 = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                limitNumberOfEvents: 2,
                aggregatorTypes: [AggregatorType.ITEMDELETIONS],
            }
        );
        const accountAggregationReport1 = aggregationReport1[accountId] as IAccountAggregationReport;
        expect(accountAggregationReport1.aggregatorReports[AggregatorType.ITEMCREATIONS]).toBeFalsy();
        const aggregationReport2 = await trackingClient.aggregateUserEvents(
            [accountId],
            {
                limitNumberOfEvents: 2,
                aggregatorTypes: [AggregatorType.ITEMCREATIONS, AggregatorType.ITEMEDITED, AggregatorType.ITEMDELETIONS],
            }
        );
        const accountAggregationReport2 = aggregationReport2[accountId] as IAccountAggregationReport;
        inspectAccountAggregationReport(accountAggregationReport2, { expectedCreations: 1, expectedEdits: 0, expectedDeletes: 0 });
    });


});
