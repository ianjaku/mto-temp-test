import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);

describe("getUsers", () => {
    
    it("resolves the passed user ids", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const client = await clientFactory.createBackend();

            const users = await client.getUsers([user.id]);

            expect(users.length).toBe(1);
            expect(users[0].id).toBe(user.id);
        });
    });

    it("resolves the passed group ids", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.createAdmin();
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, user.id);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            const users = await client.getUsers([group.id]);

            expect(users.length).toBe(1);
            expect(users[0].id).toBe(user.id);
        });
    });

    it("resolves both group ids and user ids in the same call", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const user = await fixtures.users.create();
            const groupUser = await fixtures.users.createAdmin();
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, groupUser.id);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            const users = await client.getUsers([group.id, user.id]);

            expect(users.length).toBe(2);
            expect(users.some(u => u.id === user.id)).toBeTruthy();
            expect(users.some(u => u.id === groupUser.id)).toBeTruthy();
            
        });
    })
});

