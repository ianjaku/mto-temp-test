import { User, UserCreationMethod } from "@binders/client/lib/clients/userservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TestAccountFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(config, UserServiceClient, "v1");

describe("as a PLG user", () => {
    it("getGroupsForUser is authorized", async () => {
        return withUserCreationMethodAccount(UserCreationMethod.PLG_TRIAL_V1, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const knitters = await fixtures.groups.create("Knitters");
            await fixtures.groups.addUserToGroup(knitters.id, bob.id)
            await expect(
                aliceClient.getGroupsForUser(bob.id, fixtures.getAccountId())
            ).rejects.toThrow(/authorization issue/);
        });
    });

    it("getUser is authorized", async () => {
        return withUserCreationMethodAccount(UserCreationMethod.PLG_TRIAL_V1, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            await expect(
                aliceClient.getUser(bob.id)
            ).rejects.toThrow(/authorization issue/);
        });
    });

    it("getUsers is filtered", async () => {
        return withUserCreationMethodAccount(UserCreationMethod.PLG_TRIAL_V1, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const users = await aliceClient.getUsers([bob.id]);
            expect(users).toHaveLength(0);
        });
    });

    it("multiGetGroupMembers is filtered", async () => {
        return withUserCreationMethodAccount(UserCreationMethod.PLG_TRIAL_V1, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const knitters = await fixtures.groups.create("Knitters");
            await fixtures.groups.addUserToGroup(knitters.id, bob.id)
            const details = await aliceClient.multiGetGroupMembers(
                fixtures.getAccountId(),
                [knitters.id],
                { includeUserTags: true },
            );
            expect(details).toHaveLength(1);
            expect(details.at(0)).toEqual({ group: knitters, members: [], memberCount: 1 });
        });
    });

    it("multiGetUsersAndGroups is filtered", async () => {
        return withUserCreationMethodAccount(UserCreationMethod.PLG_TRIAL_V1, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const knitters = await fixtures.groups.create("Knitters");
            await fixtures.groups.addUserToGroup(knitters.id, bob.id)
            const groups = await aliceClient.multiGetUsersAndGroups(
                fixtures.getAccountId(),
                [knitters.id, bob.id],
                true,
            );
            expect(groups).toHaveLength(1);
            expect(groups.at(0)).toEqual(knitters);
        });
    });

    it("searchUsers is filtered", async () => {
        return withUserCreationMethodAccount(UserCreationMethod.PLG_TRIAL_V1, async (fixtures, { alice }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const users = await aliceClient.searchUsers(
                { login: "plg", ignoreCase: true },
                { maxResults: 100 },
                [fixtures.getAccountId()],
            );
            expect(users.hits).toHaveLength(1);
            expect(users.hits).toMatchObject([{ login: alice.login }])
            const usersByTerm = await aliceClient.searchUsersByTerm(
                fixtures.getAccountId(),
                "plg",
                { maxResults: 100 },
            );
            expect(usersByTerm.hits).toHaveLength(1);
            expect(usersByTerm.hits).toMatchObject([{ login: alice.login }])
        });
    });
});

describe("as standard user", () => {
    it("getGroupsForUser is not authorized", async () => {
        return withUserCreationMethodAccount(undefined, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const knitters = await fixtures.groups.create("Knitters");
            await fixtures.groups.addUserToGroup(knitters.id, bob.id)
            const groups = await aliceClient.getGroupsForUser(bob.id, fixtures.getAccountId());
            expect(groups).toMatchObject([{ name: "All users" }, { name: "Knitters" }]);
        });
    });

    it("getUser is not authorized", async () => {
        return withUserCreationMethodAccount(undefined, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const user = await aliceClient.getUser(bob.id);
            expect(user).toMatchObject(bob);
        });
    });

    it("getUsers is not filtered", async () => {
        return withUserCreationMethodAccount(undefined, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const users = await aliceClient.getUsers([bob.id]);
            expect(users).toHaveLength(1);
            expect(users).toMatchObject([{ login: bob.login }])
        });
    });

    it("multiGetGroupMembers is not filtered", async () => {
        return withUserCreationMethodAccount(undefined, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const knitters = await fixtures.groups.create("Knitters");
            await fixtures.groups.addUserToGroup(knitters.id, bob.id)
            const groups = await aliceClient.multiGetGroupMembers(
                fixtures.getAccountId(),
                [knitters.id],
                { includeUserTags: true },
            );
            expect(groups).toMatchObject([{ members: [{ login: bob.login }] }])
        });
    });

    it("multiGetUsersAndGroups is not filtered", async () => {
        return withUserCreationMethodAccount(undefined, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const knitters = await fixtures.groups.create("Knitters");
            await fixtures.groups.addUserToGroup(knitters.id, bob.id)
            const groups = await aliceClient.multiGetUsersAndGroups(
                fixtures.getAccountId(),
                [knitters.id, bob.id],
                true,
            );
            expect(groups).toMatchObject([
                { login: bob.login },
                { name: "Knitters" },
            ]);
        });
    });

    it("searchUsers is not filtered", async () => {
        return withUserCreationMethodAccount(undefined, async (fixtures, { alice, bob }) => {
            const aliceClient = await clientFactory.createForFrontend(alice.id, fixtures.getAccountId);
            const users = await aliceClient.searchUsers(
                { login: "plg", ignoreCase: true },
                { maxResults: 100 },
                [fixtures.getAccountId()],
            );
            expect(users.hits).toHaveLength(2);
            expect(users.hits).toMatchObject([{ login: alice.login }, { login: bob.login }])
            const usersByTerm = await aliceClient.searchUsersByTerm(
                fixtures.getAccountId(),
                "plg",
                { maxResults: 100000 },
            );
            expect(usersByTerm.hits).toHaveLength(2);
            expect(usersByTerm.hits).toMatchObject([{ login: alice.login }, { login: bob.login }])
        });
    });
});

async function withUserCreationMethodAccount(
    creationMethod: UserCreationMethod | undefined,
    callback: (
        fixtures: TestAccountFixtures, ctx: {
            bob: User;
            alice: User;
            rootCollection: DocumentCollection;
        }) => Promise<void>
) {
    return globalFixtures.withFreshAccount(async (fixtures) => {
        const alice = await fixtures.users.create({
            login: createUniqueTestLogin("plg-alice"),
            password: createUniqueTestLogin(),
            firstName: "Alice",
            creationMethod,
        });
        const bob = await fixtures.users.create({
            login: createUniqueTestLogin("plg-bob"),
            password: createUniqueTestLogin(),
            firstName: "Bob",
            creationMethod,
        });
        const rootCollection = await fixtures.items.getOrCreateRootCollection();
        await fixtures.items.assignRoles(
            rootCollection.id,
            { Editor: [alice.login, bob.login] },
        );
        try {
            await callback(fixtures, { alice, bob, rootCollection });
        }
        finally {
            await fixtures.users.deleteUser(alice.id);
            await fixtures.users.deleteUser(bob.id);
        }
    });
}

