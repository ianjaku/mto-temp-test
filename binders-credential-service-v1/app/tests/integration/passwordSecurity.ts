import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const credFactory = new ClientFactory(
    config,
    CredentialServiceClient,
    "v1"
);

describe("User passwords", () => {
    // ASVS V2.1.4
    it("that contain special characters and spaces are allowed", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const password = "😼Ά⻣𐡗𐭻Āɜ\t  ";
            const user = await fixtures.users.create();
            const credService = await credFactory.createBackend();
            await credService.createCredential(user.id, user.login, password);
            const initialSession = await credService.loginWithPassword(user.login, password);
            // creating a UAT works only when the user is signed in
            const uat = await credService.createUserAccessToken(initialSession.sessionId, user.id);
            expect(uat).toBeTruthy();
        });
    });
});
