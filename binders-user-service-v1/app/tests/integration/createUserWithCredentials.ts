import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);
const credFactory = new ClientFactory(
    config,
    CredentialServiceClient,
    "v1"
);

describe("Creating a user", () => {
    it("should fail when passing a manual.to domain", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const userServiceClient = await clientFactory.createBackend(() => fixtures.getAccountId());
            await expect(() => userServiceClient.createUserWithCredentials("someone@manual.to", "Someone", "validPassword"))
                .rejects.toThrow("E-mail addresses using this domain are not allowed");
        });
    });

    it("should create a user", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const userLogin = `someone-${Date.now()}@example.com`;
            const userPassword = "validPassword";
            const userDisplayName = "Someone";

            const userServiceClient = await clientFactory.createBackend(() => fixtures.getAccountId());
            const user = await userServiceClient.createUserWithCredentials(userLogin, userDisplayName, userPassword);
            expect(user).toMatchObject(expect.objectContaining({
                login: userLogin,
                displayName: userDisplayName,
                firstName: "",
                lastName: "",
            }));

            const credentialServiceClient = await credFactory.createBackend();
            const session = await credentialServiceClient.loginWithPassword(userLogin, userPassword);
            expect(session).toBeTruthy();
        });
    });
});