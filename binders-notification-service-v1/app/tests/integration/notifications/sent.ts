import {
    NotificationKind,
    NotifierKind,
    PublishNotification,
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import {
    NotificationServiceClient
} from  "@binders/client/lib/clients/notificationservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { sleepMs } from "@binders/binders-service-common/lib/testutils/util";


const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    NotificationServiceClient,
    "v1"
);

describe("findSentNotifications", () => {
    it("should return an empty list when no notifications were sent", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const item = await fixtures.items.createDocument();

            const sentNotifications = await client.findSentNotifications(
                fixtures.getAccountId(),
                item.id
            );

            expect(sentNotifications.length).toBe(0);
        })
    })

    it("should return an empty list when a notification is sent on another item", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const actor = await fixtures.users.create();
            const item = await fixtures.items.createDocument();
            const otherItem = await fixtures.items.createDocument();
            await fixtures.notificationTargets.create({
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: actor.id,
                itemId: otherItem.id
            })

            await client.sendNotification({
                accountId: fixtures.getAccountId(),
                itemId: otherItem.id,
                kind: NotificationKind.PUBLISH,
                actorId: actor.id
            } as PublishNotification)

            await sleepMs(300)

            const sentNotifications = await client.findSentNotifications(
                fixtures.getAccountId(),
                item.id
            );

            expect(sentNotifications.length).toBe(0);
        })
    })

    it("should return the sent notifications", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();

            const item = await fixtures.items.createDocument();
            const actor = await fixtures.users.create();

            await fixtures.notificationTargets.create({
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: actor.id,
                itemId: item.id
            });
            await client.sendNotification({
                accountId: fixtures.getAccountId(),
                itemId: item.id,
                kind: NotificationKind.PUBLISH,
                actorId: actor.id
            } as PublishNotification);

            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(
                fixtures.getAccountId(),
                item.id
            );

            expect(sentNotifications.length).toBe(1);
        });
    });

    it("should return sent notifications for children of the current collection", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();

            const user = await fixtures.users.create();
            const coll = await fixtures.items.createCollection();
            const doc = await fixtures.items.createDocument();
            await fixtures.items.addDocToCollection(coll.id, doc.id)

            await fixtures.notificationTargets.create({
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: user.id,
                itemId: doc.id
            })
            await client.sendNotification({
                accountId: fixtures.getAccountId(),
                itemId: doc.id,
                kind: NotificationKind.PUBLISH,
                actorId: user.id
            } as PublishNotification)

            await sleepMs(300)

            const sentNotifications = await client.findSentNotifications(
                fixtures.getAccountId(),
                coll.id
            );

            expect(sentNotifications.length).toBe(1);
        });
    });

    it("should return sent notifications for grandchildren of the current collection", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();

            const user = await fixtures.users.create();
            const oldColl = await fixtures.items.createCollection();
            const newColl = await fixtures.items.createCollection();
            const babyDoc = await fixtures.items.createDocument();
            await fixtures.items.addCollToCollection(oldColl.id, newColl.id);
            await fixtures.items.addDocToCollection(newColl.id, babyDoc.id);

            await fixtures.notificationTargets.create({
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: user.id,
                itemId: newColl.id
            })
            await client.sendNotification({
                accountId: fixtures.getAccountId(),
                itemId: babyDoc.id,
                kind: NotificationKind.PUBLISH,
                actorId: user.id
            } as PublishNotification);

            await sleepMs(300)

            const sentNotifications = await client.findSentNotifications(
                fixtures.getAccountId(),
                oldColl.id
            );

            expect(sentNotifications.length).toBe(1);
        });
    });

    it("should return not sent notifications for siblings", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();

            const user = await fixtures.users.create();
            const coll = await fixtures.items.createCollection();
            const targetColl = await fixtures.items.createCollection();
            const siblingDoc = await fixtures.items.createDocument();
            const siblingColl = await fixtures.items.createCollection();
            await fixtures.items.addDocToCollection(coll.id, siblingDoc.id);
            await fixtures.items.addCollToCollection(coll.id, siblingColl.id);
            await fixtures.items.addCollToCollection(coll.id, targetColl.id);

            await fixtures.notificationTargets.create({
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: user.id,
                itemId: coll.id
            })
            await client.sendNotification({
                accountId: fixtures.getAccountId(),
                itemId: targetColl.id,
                kind: NotificationKind.PUBLISH,
                actorId: user.id
            } as PublishNotification);

            await sleepMs(300)

            const sentNotificationsColl = await client.findSentNotifications(
                fixtures.getAccountId(),
                siblingColl.id
            );
            const sentNotificationsDoc = await client.findSentNotifications(
                fixtures.getAccountId(),
                siblingDoc.id
            );

            expect(sentNotificationsColl.length).toBe(0);
            expect(sentNotificationsDoc.length).toBe(0);
        });
    });
});
