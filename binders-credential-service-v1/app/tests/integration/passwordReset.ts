import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const credFactory = new ClientFactory(
    config,
    CredentialServiceClient,
    "v1"
);

const accountFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1"
);

describe("Reset password", () => {
    it("Signs out the user from other sessions", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const credService = await credFactory.createBackend();
            await credService.createCredential(user.id, user.login, "xxxxxx");
            const initialSession = await credService.loginWithPassword(user.login, "xxxxxx");
            // creating a UAT works only when the user is signed in
            await credService.createUserAccessToken(initialSession.sessionId, user.id);
            const token = await credService.createOneTimeToken(user.id, 1, fixtures.getAccountId());
            const newSession = await credService.resetPassword(token, user.login, "yyyyyy", fixtures.getAccountId());

            await expect(() => credService.createUserAccessToken(initialSession.sessionId, user.id))
                .rejects.toThrow("Your session has expired");
            await credService.createUserAccessToken(newSession.sessionId, user.id);
        });
    });

    it("Allows resetting own password with token", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const credService = await credFactory.createBackend();
            await credService.createCredential(user.id, user.login, "whatever");

            const token = await credService.createOneTimeToken(user.id, 1, fixtures.getAccountId());
            await credService.resetPassword(token, user.login, "new-whatever", fixtures.getAccountId());

            const session = await credService.loginWithPassword(user.login, "new-whatever");
            expect(session).toMatchObject(expect.objectContaining({
                userId: user.id
            }));
        });
    });

    it("Does not allow resetting another user's password with token", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const user2 = await fixtures.users.create();
            const credService = await credFactory.createBackend();
            await credService.createCredential(user.id, user.login, "whatever");
            await credService.createCredential(user2.id, user2.login, "secret");

            const token = await credService.createOneTimeToken(user.id, 1, fixtures.getAccountId());

            await expect(() => credService.resetPassword(token, user2.login, "hello-world", fixtures.getAccountId()))
                .rejects.toThrow("Invalid login");
        });
    });

    it("Allows admins to reset the password of another user", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const admin = await fixtures.users.createAdmin();
            const user = await fixtures.users.create();
            const credClient = await credFactory.createForFrontend(admin.id);
            const newPassword = "new-password";
            await credClient.updatePasswordByAdmin(user.id, newPassword, fixtures.getAccountId());
            await credClient.loginWithPassword(user.login, newPassword);
        });
    });

    it("Dissalows non-admins to reset the password of another user", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const nonAdmin = await fixtures.users.create();
            const user = await fixtures.users.create();
            const credClient = await credFactory.createForFrontend(nonAdmin.id);
            const newPassword = "new-password";
            await expect(() => credClient.updatePasswordByAdmin(user.id, newPassword, fixtures.getAccountId()))
                .rejects.toThrow("authorization issue");
        });
    });

    it("Dissallows if admin is not an admin for all accounts", async () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const admin = await fixtures.users.createAdmin();
            const user = await fixtures.users.create();
            await globalFixtures.withFreshAccount(async (innerFixtures) => {
                const accountClient = await accountFactory.createBackend();
                const innerAccountId = innerFixtures.getAccountId();
                await accountClient.addMember(innerAccountId, user.id, ManageMemberTrigger.INTEGRATION_TEST, true);
            });
            const credClient = await credFactory.createForFrontend(admin.id);
            const newPassword = "new-password";
            await expect(() => credClient.updatePasswordByAdmin(user.id, newPassword, fixtures.getAccountId()))
                .rejects.toThrow("authorization issue");
        });
    });
});
