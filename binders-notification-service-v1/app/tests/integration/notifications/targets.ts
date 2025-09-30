import {
    NotificationKind,
    NotifierKind,
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import {
    NotificationServiceClient
} from  "@binders/client/lib/clients/notificationservice/v1/client";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { expectStatusCode } from "@binders/binders-service-common/lib/testutils/util";


const config = BindersConfig.get();

const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    NotificationServiceClient,
    "v1"
);



describe("findNotificationTargets", () => {
    it("returns an empty list when no targets have been created", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const result = await client.findNotificationTargets(
                fixtures.getAccountId(),
                NotificationKind.PUBLISH
            );
            expect(Array.isArray(result)).toBeTruthy();
            expect(result.length).toBe(0);
        });
    });

    it("returns both account wide and item specific targets", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const targetUser1 = await fixtures.users.create();
            const targetUser2 = await fixtures.users.create();

            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: targetUser1.id,
                notificationKind: NotificationKind.PUBLISH
            });

            const coll = await fixtures.items.createCollection();
            await fixtures.items.addCollToRootCollection(coll.id);
            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notifierKind: NotifierKind.GROUP_EMAIL,
                targetId: targetUser2.id,
                itemId: coll.id,
                notificationKind: NotificationKind.PUBLISH
            });

            const result = await client.findNotificationTargets(
                fixtures.getAccountId(),
                NotificationKind.PUBLISH,
                [coll.id]
            );

            expect(result.length).toBe(2);
            expect(result.some(r => r.targetId === targetUser1.id)).toBeTruthy();
            expect(result.some(r => r.targetId === targetUser2.id)).toBeTruthy();
        });
    });

    it("does not return deleted targets", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const targetUser1 = await fixtures.users.create();
            const targetUser2 = await fixtures.users.create();

            const first = await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: targetUser1.id,
                notificationKind: NotificationKind.PUBLISH
            });

            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notifierKind: NotifierKind.GROUP_EMAIL,
                targetId: targetUser2.id,
                notificationKind: NotificationKind.PUBLISH
            });

            await client.deleteNotificationTarget(
                fixtures.getAccountId(),
                first.targetId,
                NotificationKind.PUBLISH,
            );

            const result = await client.findNotificationTargets(
                fixtures.getAccountId(),
                NotificationKind.PUBLISH,
            );

            expect(result.length).toBe(1);
            expect(result.some(r => r.targetId === targetUser1.id)).toBeFalsy();
            expect(result.some(r => r.targetId === targetUser2.id)).toBeTruthy();
        });

    });

    it("returns 401 when user has no edit or admin permissions", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const client = await clientFactory.createForFrontend(user.id);
            await expectStatusCode(
                401,
                () => client.findNotificationTargets(
                    fixtures.getAccountId(),
                    NotificationKind.PUBLISH,
                )
            );
        })
    });

    it("returns 200 for users with edit permissions", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const coll = await fixtures.items.createCollection();
            await fixtures.items.addCollToRootCollection(coll.id);
            await fixtures.authorization.assignItemPermission(
                coll.id,
                user.id,
                [PermissionName.EDIT]
            );

            const client = await clientFactory.createForFrontend(user.id);
            await expectStatusCode(
                200,
                () => client.findNotificationTargets(
                    fixtures.getAccountId(),
                    NotificationKind.PUBLISH,
                    [coll.id]
                )
            );
        });
    });
});

describe("addNotificationTarget", () => {
    it("returns 401 for users without publish or admin privileges", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const client = await clientFactory.createForFrontend(user.id);
            await expectStatusCode(
                401,
                () => client.addNotificationTarget({
                    accountId: fixtures.getAccountId(),
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: "some-unique-target-id",
                    notificationKind: NotificationKind.PUBLISH
                })
            );
        })
    });

    it("returns 200 for users with publish permissions to the itemId", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const coll = await fixtures.items.createCollection();
            await fixtures.items.addCollToRootCollection(coll.id);
            await fixtures.authorization.assignItemPermission(
                coll.id,
                user.id,
                [PermissionName.PUBLISH]
            );

            const client = await clientFactory.createForFrontend(user.id);
            await expectStatusCode(
                200,
                () => client.addNotificationTarget({
                    accountId: fixtures.getAccountId(),
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: "some-other-target-id",
                    itemId: coll.id,
                    notificationKind: NotificationKind.PUBLISH
                })
            );
        });
    });

    it("returns 200 for account admins", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const user = await fixtures.users.createAdmin();
            const client = await clientFactory.createForFrontend(user.id);
            await expectStatusCode(
                200,
                () => client.addNotificationTarget({
                    accountId: fixtures.getAccountId(),
                    notifierKind: NotifierKind.USER_EMAIL,
                    targetId: "some-other-target-id",
                    notificationKind: NotificationKind.PUBLISH
                })
            );
        });
    });
});

describe("deleteNotificationTarget", () => {
    it("returns 401 for users without publish or admin privileges", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const client = await clientFactory.createForFrontend(user.id);
            await expectStatusCode(
                401,
                () => client.deleteNotificationTarget(
                    fixtures.getAccountId(),
                    "random-id",
                    NotificationKind.PUBLISH,
                )
            );
        })
    });

    it("returns 200 for users with publish permissions to the itemId", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const coll = await fixtures.items.createCollection();
            await fixtures.items.addCollToRootCollection(coll.id);
            await fixtures.authorization.assignItemPermission(
                coll.id,
                user.id,
                [PermissionName.PUBLISH]
            );

            const client = await clientFactory.createForFrontend(user.id);

            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: "some-other-target-id--",
                itemId: coll.id,
                notificationKind: NotificationKind.PUBLISH
            })

            await expectStatusCode(
                200,
                () => client.deleteNotificationTarget(
                    fixtures.getAccountId(),
                    "some-other-target-id--",
                    NotificationKind.PUBLISH,
                    coll.id
                )
            );
        });
    });

    it("returns 200 for account admins", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const user = await fixtures.users.createAdmin();
            const client = await clientFactory.createForFrontend(user.id);
            await client.addNotificationTarget({
                accountId: fixtures.getAccountId(),
                notifierKind: NotifierKind.USER_EMAIL,
                targetId: "some-other-target-id--2",
                notificationKind: NotificationKind.PUBLISH
            })
            await expectStatusCode(
                200,
                () => client.deleteNotificationTarget(
                    fixtures.getAccountId(),
                    "some-other-target-id--2",
                    NotificationKind.PUBLISH
                )
            );
        });
    });
});
