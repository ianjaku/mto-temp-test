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


describe("Overlapping targets", () => {

    it("should result in only a single message to the user", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const actor = await fixtures.users.create();
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, user.id);
            const item = await fixtures.items.createDocument();

            await fixtures.notificationTargets.create({
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.GROUP_EMAIL,
                targetId: group.id
            });

            await fixtures.notificationTargets.create({
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: user.id
            });

            await client.sendNotification({
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.PUBLISH,
                itemId: item.id,
                actorId: actor.id
            } as PublishNotification);

            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);
            expect(sentNotifications.length).toBe(1);
        });
    });

    it("should result in two messages if the notification is sent twice", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, user.id);
            const item = await fixtures.items.createDocument();
            const actor = await fixtures.users.create();

            await fixtures.notificationTargets.create({
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.GROUP_EMAIL,
                targetId: group.id
            });

            await fixtures.notificationTargets.create({
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: user.id
            });

            await client.sendNotification({
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.PUBLISH,
                itemId: item.id,
                actorId: actor.id
            } as PublishNotification);
            await client.sendNotification({
                accountId: fixtures.getAccountId(),
                kind: NotificationKind.PUBLISH,
                itemId: item.id,
                actorId: actor.id
            } as PublishNotification);

            await sleepMs(300);

            const sentNotifications = await client.findSentNotifications(fixtures.getAccountId(), item.id);
            expect(sentNotifications.length).toBe(2);
        });
    });
});
