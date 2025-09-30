import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { IAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import {User} from "@binders/client/lib/clients/userservice/v1/contract";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1"
);

describe("getAccountSettings", () => {

    it("returns user token secret when the requester is an admin of the account", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await generateUserTokenSecret(fixtures.getAccountId());
            const admin = await fixtures.users.createAdmin();

            const settings = await getAccountSettingsAs(fixtures.getAccountId(), admin.id);

            expect(settings.userTokenSecret)
                .toBeDefined();
        });
    });

    it("omits the user token secret when the requester is not an admin of the account", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await generateUserTokenSecret(fixtures.getAccountId());
            const user = await fixtures.users.create();

            const settings = await getAccountSettingsAs(fixtures.getAccountId(), user.id);

            expect(settings.userTokenSecret)
                .toBeUndefined();
        })
    });

    it("blocks requests from admins of different accounts", async () => {
        let admin: User;
        await globalFixtures.withFreshAccount(async (fixtures) => {
            admin = await fixtures.users.createAdmin();
        });
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await generateUserTokenSecret(fixtures.getAccountId());

            await expect(() => getAccountSettingsAs(fixtures.getAccountId(), admin.id))
                .rejects.toThrow("authorization issue");
        });
    });
});

const generateUserTokenSecret = async (accountId: string): Promise<void> => {
    const accountService = await clientFactory.createBackend();
    await accountService.setAccountFeatures(accountId, ["usertoken_login"]);
    await accountService.generateUserTokenSecretForAccountId(accountId);
}

const getAccountSettingsAs = async (accountId: string, userId: string): Promise<IAccountSettings> => {
    const accountService = await clientFactory.createForFrontend(userId);
    return accountService.getAccountSettings(accountId);
}