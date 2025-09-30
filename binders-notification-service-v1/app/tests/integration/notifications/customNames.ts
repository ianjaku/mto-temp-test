import {
    NotificationKind,
    NotifierKind,
    PublishNotification,
    SentNotification
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import {
    FEATURE_CUSTOM_NOTIFICATION_EMAIL_NAME
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import {
    NOTIFICATION_EMAIL_GENERIC_FROM
} from  "../../../src/notificationservice/events/dispatcher";
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

describe("Custom email names", () => {

    it("does not use a default name when the feature is not enabled", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.createAdmin();
            const recipient = await fixtures.users.create();
            const userClient = await clientFactory.createForFrontend(user.id);
            const backendClient = await clientFactory.createBackend();
            const item = await fixtures.items.createDocument({}, { addToRoot: true });

            await userClient.sendCustomNotification(
                fixtures.getAccountId(),
                item.id,
                [{
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: recipient.id
                }],
                "Subject",
                "Content"
            );

            await sleepMs(100);

            const sentNotifications = await backendClient.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.from).toBe(NOTIFICATION_EMAIL_GENERIC_FROM);
        });
    });

    it("Uses the sender name in custom notifications", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_CUSTOM_NOTIFICATION_EMAIL_NAME]);
            const user = await fixtures.users.createAdmin({ displayName: "Barbara Streisand" });
            const recipient = await fixtures.users.create();
            const userClient = await clientFactory.createForFrontend(user.id);
            const backendClient = await clientFactory.createBackend();
            const item = await fixtures.items.createDocument({}, { addToRoot: true });

            await userClient.sendCustomNotification(
                fixtures.getAccountId(),
                item.id,
                [{
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: recipient.id
                }],
                "Subject",
                "Content"
            );

            await sleepMs(100);

            const sentNotifications = await backendClient.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.from).toContain("Barbara Streisand");
        });
    });

    it("Does not use a sender name in publish notifications", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_CUSTOM_NOTIFICATION_EMAIL_NAME]);
            const user = await fixtures.users.createAdmin();
            const client = await clientFactory.createBackend();
            const item = await fixtures.items.createDocument({}, { addToRoot: true });
            await fixtures.notificationTargets.create({ targetId: user.id });

            const publishNotification: PublishNotification = {
                accountId: fixtures.getAccountId(),
                actorId: user.id,
                itemId: item.id,
                kind: NotificationKind.PUBLISH,
                publicationId: item.id,
                publicationTitle: "",
                publicationLanguageCode: "xx",
            };
            await client.sendNotification(publishNotification);

            await sleepMs(100);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);

            expect(sentNotifications.length).toBe(1);
            const messageData = sentNotifications[0].messageData as SentNotification["messageData"];
            expect(messageData.from).toBe(NOTIFICATION_EMAIL_GENERIC_FROM);
        });
    });

});

