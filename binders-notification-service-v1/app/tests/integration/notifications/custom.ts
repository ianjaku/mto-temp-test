import {
    CustomNotification,
    NotificationKind,
    NotifierKind,
    SentNotification,
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import {
    NotificationServiceClient
} from  "@binders/client/lib/clients/notificationservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { sleepMs } from "@binders/binders-service-common/lib/testutils/util";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    NotificationServiceClient,
    "v1"
);

describe("Custom notification", () => {

    it("Has the correct text and subject line", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();

            const item = await fixtures.items.createDocument();

            const notification: CustomNotification = {
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.CUSTOM,
                targets: [{
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: user.id
                }],
                actorId: user.id,
                itemId: item.id,
                subject: "test-subject",
                text: "test-text",
            };
            await client.sendNotification(notification);

            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.subject).toBe("test-subject");
            expect(messageData.text).toBe("test-text");
        })
    })

    it("reader_link on a document contains launch/[itemId]", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const item = await fixtures.items.createDocument();

            const notification: CustomNotification = {
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.CUSTOM,
                itemId: item.id,
                subject: "Hello there :)",
                text: "This is some sample text [[reader_link]]",
                actorId: user.id,
                targets: [{
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: user.id
                }]
            }
            await client.sendNotification(notification);

            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.text).toContain(`launch/${item.id}`);
        });
    })

    it("reader_link to a collection contains browse/[itemId]", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const item = await fixtures.items.createCollection();

            const notification: CustomNotification = {
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.CUSTOM,
                itemId: item.id,
                subject: "Hello there :)",
                text: "This is some sample text [[reader_link]]",
                actorId: user.id,
                targets: [{
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: user.id
                }]
            }
            await client.sendNotification(notification);
            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.text).toContain(`browse/${item.id}`);
        });
    });

    it("editor_link to a collection contains browse/[itemId]", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const item = await fixtures.items.createCollection();

            const notification: CustomNotification = {
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.CUSTOM,
                itemId: item.id,
                subject: "Hello there :)",
                text: "This is some sample text [[editor_link]]",
                actorId: user.id,
                targets: [{
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: user.id
                }]
            }
            await client.sendNotification(notification);
            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.text).toContain(`browse/${item.id}`);
        });
    });

    it("editor_link to a document contains documents/[itemId]", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const item = await fixtures.items.createDocument();

            const notification: CustomNotification = {
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.CUSTOM,
                itemId: item.id,
                subject: "Hello there :)",
                text: "This is some sample text [[editor_link]]",
                actorId: user.id,
                targets: [{
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: user.id
                }]
            }
            await client.sendNotification(notification);
            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.text).toContain(`documents/${item.id}`);
        });
    });

    it("fills in the user name correctly", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const item = await fixtures.items.createDocument();

            const notification: CustomNotification = {
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.CUSTOM,
                itemId: item.id,
                subject: "Hello there :)",
                text: "Dear [[name]]",
                actorId: user.id,
                targets: [{
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: user.id
                }]
            }
            await client.sendNotification(notification);
            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.text).toContain(`Dear ${buildUserName(user)}`);
        });
    });

    it("fills in the item title correctly", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const item = await fixtures.items.createDocument();

            const notification: CustomNotification = {
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.CUSTOM,
                itemId: item.id,
                subject: "Hello there :)",
                text: "your document: [[title]] ",
                actorId: user.id,
                targets: [{
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: user.id
                }]
            }
            await client.sendNotification(notification);
            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.text).toContain(`document: ${item.languages[0].storyTitle}`);
        });
    });
});
