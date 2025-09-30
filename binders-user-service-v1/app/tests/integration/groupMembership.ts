import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { UserType } from "@binders/client/lib/clients/userservice/v1/contract";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);

describe("Granting account admin permissions to users", () => {
    it("should succeed when user is created through regular flow", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const userServiceClient = await clientFactory.createBackend(() => fixtures.getAccountId());
            const user = await fixtures.users.create();
            const user2 = await fixtures.users.create();

            const groupId = await fixtures.getAdminGroupId();
            await userServiceClient.addGroupMember(fixtures.getAccountId(), groupId, user.id);
            await userServiceClient.multiAddGroupMembers(fixtures.getAccountId(),{ names: ["Account admins"] }, [user2.id], {});
        });
    });

    it("should fail when user is created through the editor", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const userServiceClient = await clientFactory.createBackend(() => fixtures.getAccountId());
            const userLogin = `user-${Date.now()}@example.com`;
            const user = await userServiceClient.createUserWithCredentials(userLogin, "Mr User", "some valid pass");

            const groupId = await fixtures.getAdminGroupId();
            await expect(() => userServiceClient.addGroupMember(fixtures.getAccountId(), groupId, user.id))
                .rejects.toThrow("Cannot set users created through the editor as account admin");
        });
    });

    it("should skip adding to group when user is created through the editor", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const userServiceClient = await clientFactory.createBackend(() => fixtures.getAccountId());
            const userLogin = `user-${Date.now()}@example.com`;
            const editorCreatedUser = await userServiceClient.createUserWithCredentials(userLogin, "Mr User", "some valid pass");
            const regularCreatedUser = await fixtures.users.create();

            const modifiedUserGroups = await userServiceClient.multiAddGroupMembers(fixtures.getAccountId(), { names: [ "Account admins" ] }, [ regularCreatedUser.id ], {});
            expect(modifiedUserGroups.length).toBe(1);
            const emptyUserGroups = await userServiceClient.multiAddGroupMembers(fixtures.getAccountId(), { names: [ "Account admins" ] }, [ editorCreatedUser.id ], {});
            expect(emptyUserGroups.length).toBe(0);
        });
    });
});

describe("Removing a user from all groups in an account", () => {
    it("Should remove all references to that user", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const accountId = fixtures.getAccountId();
            const userServiceClient = await clientFactory.createBackend(() => accountId);
            const user = await fixtures.users.create();
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            await fixtures.users.setDeviceTargetUsers(deviceUser.id, [user.id]);

            const groupWithUserAsOwner = await fixtures.groups.create();
            await userServiceClient.updateGroupOwners(accountId, groupWithUserAsOwner.id, [user.id]);

            const groupWithUserAsMember = await fixtures.groups.create();
            await userServiceClient.addGroupMember(accountId, groupWithUserAsMember.id, user.id);

            await userServiceClient.removeUserFromAccountUsergroups(accountId, user.id);

            // User as a group owner
            const allGroups = await userServiceClient.getGroups(accountId);
            for (const group of allGroups) {
                expect(group.ownerUserIds ?? []).not.toContain(user.id);
            }
            // User as a group member
            const groupsForUser = await userServiceClient.getGroupsForUser(user.id, accountId);
            expect(groupsForUser.length).toBe(0);

            // User as a lined device target user
            const deviceTargetIds = await userServiceClient.getDeviceTargetIds(accountId, deviceUser.id);
            expect(deviceTargetIds.length).toBe(0);
        });
    });
});
