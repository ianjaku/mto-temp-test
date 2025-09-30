import { FEATURE_USERTOKEN_LOGIN, ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import UUID from "@binders/client/lib/util/uuid";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { UserToken } from "@binders/binders-service-common/lib/tokens";
import { UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import { buildSignConfigFromSecret } from "@binders/binders-service-common/lib/tokens/jwt";

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
const accFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1"
);

describe("One Time Tokens", () => {
    it("Device user cannot generate one time tokens for other user that itself", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const userService = await userFactory.createBackend();
            const deviceUser = await userService.createUser(deviceUserLogin(), "Device User", undefined, undefined, UserType.Device, 10);
            const accountService = await accFactory.createBackend();
            await accountService.addMember(fixtures.getAccountId(), deviceUser.id, ManageMemberTrigger.INTEGRATION_TEST);

            const admin = await fixtures.users.createAdmin();

            const credService = await credFactory.createForFrontend(deviceUser.id);
            await expect(credService.createOneTimeToken(admin.id, 1, fixtures.getAccountId()))
                .rejects.toThrow(/\s*authorization issue\s+.*/);
        });
    });

    it("Device user can generate one time tokens for a linked user", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const userService = await userFactory.createBackend();
            const deviceUser = await userService.createUser(deviceUserLogin(), "Device User", undefined, undefined, UserType.Device, 10);
            const accountService = await accFactory.createBackend();
            await accountService.addMember(fixtures.getAccountId(), deviceUser.id, ManageMemberTrigger.INTEGRATION_TEST);

            const credService = await credFactory.createForFrontend(deviceUser.id);
            const password = await credService.createOneTimeToken(deviceUser.id, 1, fixtures.getAccountId());

            expect(password).toBeTruthy();
        });
    });
});

describe("User tokens", () => {
    it("A public user can login using the user token", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const userTokenSecret = await generateUserTokenSecret(fixtures.getAccountId());

            const user = await fixtures.users.create();
            const now = new Date();

            const signConfig = buildSignConfigFromSecret(userTokenSecret);
            const token = await UserToken.build(signConfig, user.id, `ext${user.id}`, now, new Date(now.getTime() + 60 * 1000));

            const credentialClient = await credFactory.createForFrontend();
            const authenticatedSession = await credentialClient.loginWithUserToken(
                token.key, fixtures.getAccountId(), "userAgent", "clientIp");

            expect(authenticatedSession).toBeTruthy();
        });
    });

    it("An invalid user token gets rejected", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const userTokenSecret = await generateUserTokenSecret(fixtures.getAccountId());

            const user = await fixtures.users.create();
            const now = new Date();

            const signConfig = buildSignConfigFromSecret(userTokenSecret);
            const token = await UserToken.build(signConfig, user.id, `ext${user.id}`, now, new Date(now.getTime() - 60 * 1000));

            const credentialClient = await credFactory.createForFrontend();
            await expect(credentialClient.loginWithUserToken(token.key, fixtures.getAccountId(), "userAgent", "clientIp"))
                .rejects.toThrow("Token is expired");

            await expect(credentialClient.loginWithUserToken("asdf", fixtures.getAccountId(), "userAgent", "clientIp"))
                .rejects.toThrow("Invalid user token");
        });
    });
});

function deviceUserLogin(): string {
    return `${UUID.random().toString()}@example.com`;
}

const generateUserTokenSecret = async (accountId: string): Promise<string> => {
    const accountService = await accFactory.createBackend();
    await accountService.setAccountFeatures(accountId, [FEATURE_USERTOKEN_LOGIN]);
    return accountService.generateUserTokenSecretForAccountId(accountId);
}