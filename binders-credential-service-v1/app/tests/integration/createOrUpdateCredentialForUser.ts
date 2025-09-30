import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { FEATURE_GROUP_OWNERS } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    TestAccountFixtures
} from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import {UserType} from "@binders/client/lib/clients/userservice/v1/contract";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const credFactory = new ClientFactory(
    config,
    CredentialServiceClient,
    "v1"
);

const userFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);

async function withTestAccount( callback: (fixtures: TestAccountFixtures) => Promise<void>) {
    return globalFixtures.withFreshAccount(async (fixtures) => {
        await fixtures.enableFeatures([
            FEATURE_GROUP_OWNERS
        ]);
        await callback(fixtures);
    });
}

describe("Create or update credential for user", () => {
    it("Allows creating the credentials on first call", async () => {
        return withTestAccount(async (fixtures) => {
            const groupOwner = await fixtures.users.create();
            const user = await fixtures.users.create();
            await fixtures.users.addTag(user.id, { name: "employeeId", context: "ceva", value: "1234", type: "string" });

            const group = await fixtures.groups.create("test");
            await fixtures.groups.addUserToGroup(group.id, user.id);
            const userClient = await userFactory.createBackend();
            await userClient.updateGroupOwners(fixtures.getAccountId(), group.id, [groupOwner.id]);

            const credService = await credFactory.createForFrontend(groupOwner.id);
            await credService.createOrUpdateCredentialForUser(fixtures.getAccountId(), user.id, user.login, "xxxxxx");

            const backendCredService = await credFactory.createBackend();
            const initialSession = await backendCredService.loginWithPassword(user.login, "xxxxxx");
            expect(initialSession).toEqual(expect.objectContaining({
                userId: user.id
            }));
        });
    });

    it("Allows updating the credentials on second call", async () => {
        return withTestAccount(async (fixtures) => {
            const groupOwner = await fixtures.users.create();
            const user = await fixtures.users.create();
            await fixtures.users.addTag(user.id, { name: "employeeId", context: "ceva", value: "1234", type: "string" });

            const group = await fixtures.groups.create("test");
            await fixtures.groups.addUserToGroup(group.id, user.id);
            const userClient = await userFactory.createBackend();
            await userClient.updateGroupOwners(fixtures.getAccountId(), group.id, [groupOwner.id]);

            const credService = await credFactory.createForFrontend(groupOwner.id);
            await credService.createOrUpdateCredentialForUser(fixtures.getAccountId(), user.id, user.login, "xxxxxx");
            await credService.createOrUpdateCredentialForUser(fixtures.getAccountId(), user.id, user.login, "yyyyyy");

            const backendCredService = await credFactory.createBackend();
            const initialSession = await backendCredService.loginWithPassword(user.login, "yyyyyy");
            expect(initialSession).toEqual(expect.objectContaining({
                userId: user.id
            }));
        });
    });

    it("Allows updating the credentials for user in group by a device user", async () => {
        return withTestAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            await fixtures.users.addTag(user.id, { name: "employeeId", context: "ceva", value: "1234", type: "string" });
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, user.id);
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            await fixtures.users.setDeviceTargetUsers(deviceUser.id, [group.id]);

            const credService = await credFactory.createForFrontend(deviceUser.id);
            await credService.createOrUpdateCredentialForUser(fixtures.getAccountId(), user.id, user.login, "xxxxxx");

            const backendCredService = await credFactory.createBackend();
            const initialSession = await backendCredService.loginWithPassword(user.login, "xxxxxx");
            expect(initialSession).toEqual(expect.objectContaining({
                userId: user.id
            }));
        });
    });

    it("Does not allow updating credentials for non group owners", async () => {
        return withTestAccount(async (fixtures) => {
            const nonGroupOwner = await fixtures.users.create();
            const user = await fixtures.users.create();
            await fixtures.users.addTag(user.id, { name: "employeeId", context: "ceva", value: "1234", type: "string" });

            const group = await fixtures.groups.create("test");
            await fixtures.groups.addUserToGroup(group.id, user.id);

            const credService = await credFactory.createForFrontend(nonGroupOwner.id);
            await expect(() => credService.createOrUpdateCredentialForUser(fixtures.getAccountId(), user.id, user.login, "xxxxxx"))
                .rejects.toThrow("authorization issue");
        });
    });

    it("Does not allow updating wrong login userId combination", async () => {
        return withTestAccount(async (fixtures) => {
            const groupOwner = await fixtures.users.create();
            const user = await fixtures.users.create();
            await fixtures.users.addTag(user.id, { name: "employeeId", context: "ceva", value: "1234", type: "string" });

            const group = await fixtures.groups.create("test");
            await fixtures.groups.addUserToGroup(group.id, user.id);
            const userClient = await userFactory.createBackend();
            await userClient.updateGroupOwners(fixtures.getAccountId(), group.id, [groupOwner.id]);

            const credService = await credFactory.createForFrontend(groupOwner.id);
            await credService.createOrUpdateCredentialForUser(fixtures.getAccountId(), user.id, user.login, "xxxxxx");
            await expect(() => credService.createOrUpdateCredentialForUser(fixtures.getAccountId(), user.id, user.login + "new", "yyyyyy"))
                .rejects.toThrow("Invalid credential")
        });
    });

    it("throws unauthorized when the user does not have a ceva employeeId", () => {
        return withTestAccount(async (fixtures) => {
            const groupOwner = await fixtures.users.create();
            const user = await fixtures.users.create();
            const group = await fixtures.groups.create("test");
            await fixtures.groups.addUserToGroup(group.id, user.id);
            const userClient = await userFactory.createBackend();
            await userClient.updateGroupOwners(fixtures.getAccountId(), group.id, [groupOwner.id]);

            const credService = await credFactory.createForFrontend(groupOwner.id);

            expect(
                credService.createOrUpdateCredentialForUser(fixtures.getAccountId(), user.id, user.login, "xxxxxx")
            ).rejects.toThrow("authorization issue (401)")
        });
    });

    it("throw unauthorized when trying to edit a manual.to user", () => {
        return withTestAccount(async (fixtures) => {
            const groupOwner = await fixtures.users.create();
            const randomId = Math.random().toString(36).substring(2);
            const user = await fixtures.users.create({ login: randomId + "@manual.to" });
            const group = await fixtures.groups.create("test");
            await fixtures.groups.addUserToGroup(group.id, user.id);
            const userClient = await userFactory.createBackend();
            await userClient.updateGroupOwners(fixtures.getAccountId(), group.id, [groupOwner.id]);

            const credService = await credFactory.createForFrontend(groupOwner.id);

            expect(
                credService.createOrUpdateCredentialForUser(fixtures.getAccountId(), user.id, user.login, "xxxxxx")
            ).rejects.toThrow("authorization issue (401)")
        });
    });
});
