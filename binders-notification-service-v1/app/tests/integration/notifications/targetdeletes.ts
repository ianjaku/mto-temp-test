/**
* Make sure that when the target of a notificationtarget gets deleted
* that the notificationtarget is also deleted.
*/
import {
    NotificationKind,
    NotifierKind
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import {
    NotificationServiceClient
} from  "@binders/client/lib/clients/notificationservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { sleepMs } from "@binders/binders-service-common/lib/testutils/util";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    NotificationServiceClient,
    "v1"
);
const userClientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);

describe("NotificationTarget", () => {
    it("should delete the notificationtargets when a user is deleted", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const userClient = await userClientFactory.createBackend();
            const user = await fixtures.users.create();

            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notificationKind: NotificationKind.PUBLISH,
                targetId: user.id,
                notifierKind: NotifierKind.USER_EMAIL
            });

            await userClient.deleteUser(user.id);

            await sleepMs(1000);

            const notificationTargets = await client.findNotificationTargets(
                fixtures.getAccountId(),
                NotificationKind.PUBLISH
            );

            expect(notificationTargets.length).toBe(0);
        });
    });

    it("should not delete the notification target when the user is not deleted", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notificationKind: NotificationKind.PUBLISH,
                targetId: user.id,
                notifierKind: NotifierKind.USER_EMAIL
            });

            const notificationTargets = await client.findNotificationTargets(
                fixtures.getAccountId(),
                NotificationKind.PUBLISH
            );

            expect(notificationTargets.length).toBe(1);
        });
    });

    it("should delete notification targets when a group is deleted", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const group = await fixtures.groups.create();

            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.GROUP_EMAIL,
                targetId: group.id
            });

            const userClient = await userClientFactory.createBackend();
            await userClient.removeGroup(fixtures.getAccountId(), group.id);

            await sleepMs(300);

            const notificationTargets = await client.findNotificationTargets(
                fixtures.getAccountId(),
                NotificationKind.PUBLISH
            );

            expect(notificationTargets.length).toBe(0);
        });
    });

    it("should not delete notification targets when the group is not deleted", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const group = await fixtures.groups.create();

            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notificationKind: NotificationKind.PUBLISH,
                notifierKind: NotifierKind.GROUP_EMAIL,
                targetId: group.id
            });


            const notificationTargets = await client.findNotificationTargets(
                fixtures.getAccountId(),
                NotificationKind.PUBLISH
            );

            expect(notificationTargets.length).toBe(1);
        });
    });
})
