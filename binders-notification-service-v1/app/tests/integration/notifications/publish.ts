import {
    NotificationKind,
    NotifierKind,
    PublishNotification,
    SentNotification
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import {
    NotificationServiceClient
} from  "@binders/client/lib/clients/notificationservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { sleepMs } from "@binders/binders-service-common/lib/testutils/util";


const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    NotificationServiceClient,
    "v1"
);

describe("Publish notification", () => {

    it("includes the document title", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const actor = await fixtures.users.create();
            const user = await fixtures.users.create();
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
            await client.sendNotification(publishNotification);

            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), doc.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.text).toContain(extractTitle(doc));
        });
    });

    it("includes the actor first & last name", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const recipient = await fixtures.users.create();
            const actor = await fixtures.users.create({
                firstName: "Mojojo",
                lastName: "Jojo"
            });
            const item = await fixtures.items.createDocument();
            await fixtures.notificationTargets.create({
                itemId: item.id,
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: recipient.id
            });

            await client.sendNotification({
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.PUBLISH,
                actorId: actor.id,
                itemId: item.id
            } as PublishNotification);

            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.text).toContain("Mojojo");
            expect(messageData.text).toContain("Jojo");
        });
    });
});
