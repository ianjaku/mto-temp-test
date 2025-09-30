import { User, UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import UUID from "@binders/client/lib/util/uuid";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { createDeviceUserEmail } from "@binders/client/lib/clients/userservice/v1/helpers";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(config, UserServiceClient, "v1");
const credentialClientFactory = new ClientFactory(config, CredentialServiceClient, "v1");

describe("createDeviceTargetUsers", () => {
    it("Creates a new user when no user with the login exists", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const { newUsers } = await client.createDeviceTargetUsers(
                ["johnny"],
                fixtures.getAccountId(),
                deviceUser.login
            );
            expect(newUsers.length).toBe(1);
            expect(newUsers[0].login).toBe(
                createDeviceUserEmail(
                    "johnny@some.account",
                    deviceUser.login,
                    fixtures.getDomain()
                )
            );
        });
    });

    it("Adds a newly created user to the account", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const { newUsers } = await client.createDeviceTargetUsers(
                ["johnny"],
                fixtures.getAccountId(),
                deviceUser.login
            );
            const account = await fixtures.getAccount();
            expect(account.members.some(id => id === newUsers[0].id)).toBe(true);
        });
    });

    it("Does not create duplicate device users", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const targetUser = await fixtures.users.create({
                login: createDeviceUserEmail(
                    "bobbymcferrin",
                    deviceUser.login,
                    fixtures.getDomain()
                )
            });
            const { newUsers } = await client.createDeviceTargetUsers(
                ["bobbymcferrin"],
                fixtures.getAccountId(),
                deviceUser.login
            );
            expect(newUsers[0].id).toBe(targetUser.id);
        });
    });

    it("Adds existing device users, that are not a member of the account, to the account", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const targetUser = await fixtures.users.create({
                login: createDeviceUserEmail(
                    "bobbymcferrin",
                    deviceUser.login,
                    fixtures.getDomain()
                )
            }, { dontAddToAccount: true });
            await client.createDeviceTargetUsers(
                ["bobbymcferrin"],
                fixtures.getAccountId(),
                deviceUser.login
            );
            const account = await fixtures.getAccount();
            expect(account.members.some(id => id === targetUser.id)).toBe(true);
        });
    });

    it("Blocks linking users from different accounts as target users", async () => {
        let adminInDifferentAccount: User;
        await globalFixtures.withFreshAccount(async (fixtures) => {
            adminInDifferentAccount = await fixtures.users.createAdmin();
        });
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const client = await clientFactory.createBackend();
            await expect(() => client.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, [adminInDifferentAccount.id]))
                .rejects.toThrow(/\s*Unauthorized\s+.*/);
        });
    });

    it("Blocks linking users non-existing ids as target users", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const client = await clientFactory.createBackend();
            await expect(() => client.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, ["uid-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]))
                .rejects.toThrow(/\s*Unauthorized\s+.*/);
        });
    });

    it("Blocks linking manual.to users as target users", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const manualtoUser = await fixtures.users.create({
                firstName: "internal",
                lastName: "user",
                login: `internaluser${UUID.random().toString()}@manual.to`,
            });
            const targetUser = await fixtures.users.create({
                firstName: "customer",
                lastName: "user",
                login: `customeruser${UUID.random().toString()}@customer.to`,
            });
            const client = await clientFactory.createBackend();
            await client.assignDeviceTargetUsers(
                fixtures.getAccountId(),
                deviceUser.id,
                [manualtoUser.id, targetUser.id]
            );
            const links = await client.getDeviceTargetUserLinks(fixtures.getAccountId());
            expect(links.find(l => l.deviceUserId === deviceUser.id).userIds).toContain(targetUser.id);
            expect(links.find(l => l.deviceUserId === deviceUser.id).userIds).not.toContain(manualtoUser.id);
        });
    });

    it("Can link groups as device targets", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const targetUser = await fixtures.users.create({
                firstName: "customer",
                lastName: "user",
                login: `customeruser${UUID.random().toString()}@customer.to`,
            });
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, targetUser.id);
            const client = await clientFactory.createBackend();
            await client.assignDeviceTargetUsers(
                fixtures.getAccountId(),
                deviceUser.id,
                [group.id]
            );
            const links = await client.getDeviceTargetUserLinks(fixtures.getAccountId());
            expect(links.find(l => l.deviceUserId === deviceUser.id).userIds).toContain(group.id);
        });
    });

});

describe("createDeviceTargetUsers", () => {
    it("can have users impersonating other users if they're linked as a target", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const targetUser = await fixtures.users.create({
                firstName: "customer",
                lastName: "user",
                login: `customeruser${UUID.random().toString()}@customer.to`,
            });
            const [userClient, credentialClientForDeviceUser] = await Promise.all([
                clientFactory.createBackend(),
                credentialClientFactory.createForFrontend(deviceUser.id),
            ]);
            await userClient.assignDeviceTargetUsers(
                fixtures.getAccountId(),
                deviceUser.id,
                [targetUser.id]
            );
            const session = await credentialClientForDeviceUser.getImpersonatedSession(targetUser.id, fixtures.getAccountId());
            expect(session.userId).toEqual(targetUser.id);
        })
    })

    it("can have users impersonating other users if they're linked as a target - through a usergroup", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const targetUser = await fixtures.users.create({
                firstName: "customer",
                lastName: "user",
                login: `customeruser${UUID.random().toString()}@customer.to`,
            });
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, targetUser.id);
            const [userClient, credentialClientForDeviceUser] = await Promise.all([
                clientFactory.createBackend(),
                credentialClientFactory.createForFrontend(deviceUser.id),
            ]);
            await userClient.assignDeviceTargetUsers(
                fixtures.getAccountId(),
                deviceUser.id,
                [group.id]
            );
            const session = await credentialClientForDeviceUser.getImpersonatedSession(targetUser.id, fixtures.getAccountId());
            expect(session.userId).toEqual(targetUser.id);
        })
    })

    it("denies users to impersonate other users if they're not linked as a target", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const someRando = await fixtures.users.create({
                firstName: "customer",
                lastName: "user",
                login: `customeruser${UUID.random().toString()}@customer.to`,
            });
            const credentialClientForDeviceUser = await credentialClientFactory.createForFrontend(deviceUser.id);
            await expect(() => credentialClientForDeviceUser.getImpersonatedSession(someRando.id, fixtures.getAccountId()))
                .rejects.toThrow(/\s*unhandled error during authorization\s+.*/);
        })
    })

    it("denies users to impersonate manual.to users", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const mtUser = await fixtures.users.create({
                firstName: "bob",
                lastName: "the colleague",
                login: `bob${UUID.random().toString()}@manual.to`,
            });
            const group = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(group.id, mtUser.id);
            const [userClient, credentialClientForDeviceUser] = await Promise.all([
                clientFactory.createBackend(),
                credentialClientFactory.createForFrontend(deviceUser.id),
            ]);
            await userClient.assignDeviceTargetUsers(
                fixtures.getAccountId(),
                deviceUser.id,
                [group.id]
            );
            await expect(() => credentialClientForDeviceUser.getImpersonatedSession(mtUser.id, fixtures.getAccountId()))
                .rejects.toThrow(/\s*unhandled error during authorization\s+.*/);
        })
    })
});

describe("getDeviceTargetIds", () => {
    it("returns the device user targets for a device user", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const targetUser = await fixtures.users.create();
            const targetUserInGroup = await fixtures.users.create();
            const targetGroup1 = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(targetGroup1.id, targetUserInGroup.id);
            const targetGroup2 = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(targetGroup2.id, targetUserInGroup.id);

            const userClient = await clientFactory.createBackend();
            await userClient.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, [targetUser.id, targetGroup1.id, targetGroup2.id]);

            const clientForDeviceUser = await clientFactory.createForFrontend(deviceUser.id);
            const deviceTargetUsersExpanded = await clientForDeviceUser.getDeviceTargetIds(fixtures.getAccountId(), deviceUser.id, true);
            expect(deviceTargetUsersExpanded.length).toBe(2);
            expect(deviceTargetUsersExpanded)
                .toEqual(expect.arrayContaining([targetUser.id, targetUserInGroup.id]));

            const deviceTargetUsers = await clientForDeviceUser.getDeviceTargetIds(fixtures.getAccountId(), deviceUser.id);
            expect(deviceTargetUsersExpanded.length).toBe(2);
            expect(deviceTargetUsers)
                .toEqual(expect.arrayContaining([targetUser.id, targetGroup1.id]));
        });
    });

    it("returns an empty list when requester is regular user", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const targetUser = await fixtures.users.create();
            const userClient = await clientFactory.createBackend();
            await userClient.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, [targetUser.id]);
            const rando = await fixtures.users.create();
            const clientForDeviceUser = await clientFactory.createForFrontend(rando.id);
            const deviceTargetUsers = await clientForDeviceUser.getDeviceTargetIds(fixtures.getAccountId(), rando.id);
            expect(deviceTargetUsers.length).toBe(0);
        });
    });


    it("throws when requester is another user than requested device user, from front-end client", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const deviceUser2 = await fixtures.users.create({ type: UserType.Device });
            const clientForDeviceUser = await clientFactory.createForFrontend(deviceUser2.id);
            expect(() => clientForDeviceUser.getDeviceTargetIds(fixtures.getAccountId(), deviceUser.id))
                .rejects.toThrow(/authorization issue/);
        });
    });
});

describe("usergroup intersection", () => {
    it("can have users impersonating other users i're linked as a target - through a usergroup intersection", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });
            const knitterPrinterBe = await fixtures.users.create({
                firstName: "Printer",
                lastName: "in Belgium",
                login: `printer-be-${UUID.random().toString()}@customer.to`,
            });
            const knitterBe = await fixtures.users.create({
                firstName: "Knitter",
                lastName: "in Belgium",
                login: `knitter-be-${UUID.random().toString()}@customer.to`,
            });
            const knitterFr = await fixtures.users.create({
                firstName: "Knitter",
                lastName: "in France",
                login: `knitter-fr-${UUID.random().toString()}@customer.to`,
            });

            const groupKnitters = await fixtures.groups.create("Knitters");
            const groupPrinters = await fixtures.groups.create("Printers");
            const groupFrance = await fixtures.groups.create("France");
            const groupBelgium = await fixtures.groups.create("Belgium");
            await fixtures.groups.addUserToGroup(groupKnitters.id, knitterBe.id);
            await fixtures.groups.addUserToGroup(groupKnitters.id, knitterFr.id);
            await fixtures.groups.addUserToGroup(groupFrance.id, knitterFr.id);
            await fixtures.groups.addUserToGroup(groupBelgium.id, knitterBe.id);
            await fixtures.groups.addUserToGroup(groupKnitters.id, knitterPrinterBe.id);
            await fixtures.groups.addUserToGroup(groupPrinters.id, knitterPrinterBe.id);
            await fixtures.groups.addUserToGroup(groupBelgium.id, knitterPrinterBe.id);

            const client = await clientFactory.createBackend();

            await client.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, [], [[groupFrance.id, groupBelgium.id]]);
            expect(await client.getDeviceTargetIds(fixtures.getAccountId(), deviceUser.id, true))
                .toStrictEqual([]);

            await client.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, [], [[groupKnitters.id, groupBelgium.id]]);
            expect(await client.getDeviceTargetIds(fixtures.getAccountId(), deviceUser.id, true))
                .toStrictEqual([knitterBe.id, knitterPrinterBe.id]);

            await client.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, [], [[groupKnitters.id, groupPrinters.id, groupBelgium.id]]);
            expect(await client.getDeviceTargetIds(fixtures.getAccountId(), deviceUser.id, true))
                .toStrictEqual([knitterPrinterBe.id]);

            await client.assignDeviceTargetUsers(fixtures.getAccountId(), deviceUser.id, [], [[groupKnitters.id, groupBelgium.id]]);
            const credentialClientForDeviceUser = await credentialClientFactory.createForFrontend(deviceUser.id);
            expect(await credentialClientForDeviceUser.getImpersonatedSession(knitterBe.id, fixtures.getAccountId()))
                .toMatchObject({ userId: knitterBe.id });
            expect(await credentialClientForDeviceUser.getImpersonatedSession(knitterPrinterBe.id, fixtures.getAccountId()))
                .toMatchObject({ userId: knitterPrinterBe.id });
            await expect(() => credentialClientForDeviceUser.getImpersonatedSession(knitterFr.id, fixtures.getAccountId()))
                .rejects.toThrow(/\s*unhandled error during authorization\s+.*/);
        });

    });
});
