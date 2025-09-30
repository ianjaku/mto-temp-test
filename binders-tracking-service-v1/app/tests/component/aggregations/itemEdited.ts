/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    AggregatorType,
    Event,
    EventType,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";

/*

test strategy:
    preparation:
    Log 2 edit events with sess-A and 2 edit events with sess-B

    Aggregate with a 3 event limit
    -> expect 2 useractions in the account

    Aggregate once again
    -> expect still 2 useractions in the account
    -> expect updated end date of the second useraction
*/

describe("aggregation of item edited events", () => {

    const config = BindersConfig.get();
    const globalFixtures = new TestFixtures(config);
    const trackingClientFactory = new ClientFactory(
        config,
        TrackingServiceClient,
        "v1"
    );

    const userId = "uid-123";

    function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    let trackingClient: TrackingServiceClient;
    let accountId;
    let endOfSecondSession: number;
    let dataEndOfSecondSession: number;

    const title = "some doc";
    const sessionId1 = "sess-A";
    const sessionId2 = "sess-B";

    function buildEditEvent(
        accountId: string,
        binderId: string,
        title: string,
        sessionId: string,
        userId: string,
    ): Event {
        const timestamp = new Date().getTime();
        return {
            eventType: EventType.BINDER_EDITED,
            accountId,
            data: {
                sessionId,
                binderId,
                itemId: binderId,
                itemKind: "binder",
                userId,
                itemTitle: title,
                isoCode: "en",
            },
            timestamp,
            timestampLogged: timestamp,
        }
    }

    beforeAll(async () => {
        trackingClient = await trackingClientFactory.createBackend();
        await globalFixtures.withFreshAccount(async (fixtures) => {
            accountId = fixtures.getAccountId();
            const binder = await fixtures.items.createDocument({
                title,
                chunkTexts: ["A", "manual consisting", "of three chunks"],
                languageCode: "en",
            }, { addToRoot: true });
            await trackingClient.log([buildEditEvent(accountId, binder.id, title, sessionId1, userId)], userId, true);
            await sleep(500);
            await trackingClient.log([buildEditEvent(accountId, binder.id, title, sessionId1, userId)], userId, true);
            await sleep(500);
            await trackingClient.log([buildEditEvent(accountId, binder.id, title, sessionId2, userId)], userId, true);
            await sleep(500);
            await trackingClient.log([buildEditEvent(accountId, binder.id, title, sessionId2, userId)], userId, true);
            await sleep(500);
        });
    });

    test("Aggregation 1: expect 2 edit useractions", async () => {
        await trackingClient.aggregateUserEvents(
            [accountId],
            {
                limitNumberOfEvents: 3,
                aggregatorTypes: [AggregatorType.ITEMEDITED],
            }
        );
        await sleep(2000);
        const findResult = await trackingClient.findUserActions({ accountId, userActionTypes: [UserActionType.ITEM_EDITED] });
        const userActions = findResult.userActions;
        expect(userActions.length).toBe(2);
        const secondOne = userActions[1];
        endOfSecondSession = new Date(secondOne.end).getTime();
        dataEndOfSecondSession = secondOne.data["end"];
    });

    test("Aggregation 2: expect existing useraction has been extended", async () => {
        await trackingClient.aggregateUserEvents(
            [accountId],
            {
                aggregatorTypes: [AggregatorType.ITEMEDITED],
            }
        );
        await sleep(2000);
        const findResult = await trackingClient.findUserActions({ accountId, userActionTypes: [UserActionType.ITEM_EDITED] });
        const userActions = findResult.userActions;
        expect(userActions.length).toBe(2);
        const secondOne = userActions.find((ua) => ua.data["sessionId"] === sessionId2);
        expect(new Date(secondOne.end).getTime()).toBeGreaterThan(endOfSecondSession);
        expect(secondOne.data["end"]).toBeGreaterThan(dataEndOfSecondSession);
    });

});
