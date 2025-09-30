import {
    NotificationKind,
    NotifierKind,
    PublishNotification
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import {
    NotificationServiceClient
} from  "@binders/client/lib/clients/notificationservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { add } from "date-fns";
import { sleepMs } from "@binders/binders-service-common/lib/testutils/util";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    NotificationServiceClient,
    "v1"
);

describe("findScheduledNotifications", () => {

    it("returns an empty list when no scheduled events exist", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();

            const item = await fixtures.items.createDocument();

            const notifications = await client.findScheduledNotifications(
                fixtures.getAccountId(),
                item.id,
                NotificationKind.PUBLISH
            );
            expect(notifications.length).toBe(0);
        });
    });

    it("returns a scheduled notification on the given item", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const item = await fixtures.items.createDocument();
            const actor = await fixtures.users.create();

            const notification: PublishNotification = {
                kind: NotificationKind.PUBLISH,
                accountId: fixtures.getAccountId(),
                itemId: item.id,
                actorId: actor.id,
                publicationId: item.id,
                publicationTitle: "",
                publicationLanguageCode: "xx",
            }
            await client.sendNotification(notification, {
                sendAt: add(new Date(), { years: 1 })
            });
            await sleepMs(300);

            const notifications = await client.findScheduledNotifications(
                fixtures.getAccountId(),
                item.id,
                NotificationKind.PUBLISH
            );
            expect(notifications.length).toBe(1);
        });
    });

});

describe("sendNotification with sendAt", () => {

    it("gets sent if sendAt is withing 5 minutes", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const actor = await fixtures.users.create();
            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: user.id,
                notificationKind: NotificationKind.PUBLISH
            });
            const doc = await fixtures.items.createDocument();
            await fixtures.items.addDocToRootCollection(doc.id);

            const publishNotification: PublishNotification = {
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.PUBLISH,
                itemId: doc.id,
                actorId: actor.id,
                publicationId: doc.id,
                publicationTitle: "",
                publicationLanguageCode: "xx",
            };
            await client.sendNotification(publishNotification, { sendAt: new Date() });

            await sleepMs(400);
            const before = await client.findSentNotifications(fixtures.getAccountId(), doc.id);
            expect(before.length).toBe(0);

            await client.runScheduledEvents();

            await sleepMs(400);
            const after = await client.findSentNotifications(fixtures.getAccountId(), doc.id);
            expect(after.length).toBe(1);
        });
    });

    it("doesn't get sent if sendAt is more than 5 minutes away", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const actor = await fixtures.users.create();
            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: user.id,
                notificationKind: NotificationKind.PUBLISH
            });
            const doc = await fixtures.items.createDocument();
            await fixtures.items.addDocToRootCollection(doc.id);

            const publishNotification: PublishNotification = {
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.PUBLISH,
                itemId: doc.id,
                actorId: actor.id,
                publicationId: doc.id,
                publicationTitle: "",
                publicationLanguageCode: "xx",
            };

            const date1HourAway = add(new Date(), { hours: 1 });
            await client.sendNotification(publishNotification, { sendAt: date1HourAway });

            await sleepMs(400);
            const before = await client.findSentNotifications(fixtures.getAccountId(), doc.id);
            expect(before.length).toBe(0);

            await client.runScheduledEvents();

            await sleepMs(400);
            const after = await client.findSentNotifications(fixtures.getAccountId(), doc.id);
            expect(after.length).toBe(0);
        });
    });

});

