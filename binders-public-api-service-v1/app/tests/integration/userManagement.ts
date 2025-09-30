import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { PublicApiServiceClient } from "@binders/client/lib/clients/publicapiservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import UUID from "@binders/client/lib/util/uuid";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { validateUserId } from "@binders/client/lib/clients/validation";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    PublicApiServiceClient,
    "v1"
);
const userClientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);
const accountClientFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1"
);
const credentialClientFactory = new ClientFactory(
    config,
    CredentialServiceClient,
    "v1"
);


const OTHER_ACCOUNT = "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6";

describe("userManagement", () => {
    it("blocks createUser when the account in the token doesn't match the one in the request", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const user = await fixtures.users.createAdmin();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            await expect(
                client.createUser(
                    OTHER_ACCOUNT,
                    `newuser_1_${`${Math.random()}`.substring(2)}}@some-other-account.io`,
                    "new user",
                )
            ).rejects.toThrow(/.*Request was blocked*/);
        });
    });
    it("blocks createUser when the user in the token isn't an admin of the account in the token", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const user = await fixtures.users.create();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            await expect(
                client.createUser(
                    fixtures.getAccountId(),
                    `newuser${`${Math.random()}`.substring(2)}@some-other-account.io`,
                    "new user",
                )
            ).rejects.toThrow(/.*authorization issue*/);
        });
    });
    it("can create a user successfully", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const user = await fixtures.users.createAdmin();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            const result = await client.createUser(
                fixtures.getAccountId(),
                `newuser${`${Math.random()}`.substring(2)}}@some-other-account.io`,
                "new user",
            );
            expect(validateUserId(result.userId)).toHaveLength(0);
            const [userClient, accountClient] = await Promise.all([
                userClientFactory.createBackend(),
                accountClientFactory.createBackend(),
            ]);
            const fetchedUser = await userClient.getUser(result.userId);
            expect(fetchedUser.id).toEqual(result.userId);
            const account = await accountClient.getAccount(fixtures.getAccountId());
            expect(account.members).toContain(result.userId);
        });
    });

    it("blocks deleteUser when the account in the token doesn't match the one in the request", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const user = await fixtures.users.createAdmin();
            const userToDelete = await fixtures.users.create();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            await expect(
                client.deleteUser(
                    OTHER_ACCOUNT,
                    userToDelete.id,
                )
            ).rejects.toThrow(/.*Request was blocked*/);
        });
    });
    it("blocks deleteUser when the user in the token isn't an admin of the account in the token", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const user = await fixtures.users.create();
            const userToDelete = await fixtures.users.create();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            await expect(
                client.deleteUser(
                    fixtures.getAccountId(),
                    userToDelete.id,
                )
            ).rejects.toThrow(/.*authorization issue*/);
        });
    });
    it("can delete a user successfully", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const user = await fixtures.users.createAdmin();
            const userToDelete = await fixtures.users.create();
            const client = await clientFactory.createForPublicApi(user.id, fixtures.getAccountId());
            const result = await client.deleteUser(
                fixtures.getAccountId(),
                userToDelete.id,
            );
            expect(validateUserId(result.userId)).toHaveLength(0);
            expect(result.userId).toEqual(userToDelete.id);
            const accountClient = await accountClientFactory.createBackend();
            const account = await accountClient.getAccount(fixtures.getAccountId());
            expect(account.members).not.toContain(userToDelete.id);
        });
    });
    it("a removed user can be added back to an account", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const userLogin = `${UUID.random().toString()}@example.com`;
            const userPassword = "somepass";
            const admin = await fixtures.users.createAdmin();
            const client = await clientFactory.createForPublicApi(admin.id, fixtures.getAccountId());
            const initialUser = await client.createUser(fixtures.getAccountId(), userLogin, "User to add back", undefined, undefined, userPassword);
            await client.deleteUser(fixtures.getAccountId(), initialUser.userId);
            const readdedUser = await client.createUser(fixtures.getAccountId(), userLogin, "User to add back", undefined, undefined, "otherPassword");

            expect(initialUser.userId).toEqual(readdedUser.userId);
            const accountClient = await accountClientFactory.createBackend();
            const account = await accountClient.getAccount(fixtures.getAccountId());
            expect(account.members).toContain(readdedUser.userId);

            const credentialClient = await credentialClientFactory.createForFrontend(initialUser.userId);
            const session = await credentialClient.loginWithPassword(userLogin, userPassword);
            expect(session?.sessionId).toBeDefined();
        });
    });
});
