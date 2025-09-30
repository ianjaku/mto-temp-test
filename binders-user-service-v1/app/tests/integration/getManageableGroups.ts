import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { FEATURE_GROUP_OWNERS } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    TestAccountFixtures
} from  "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const userFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);

async function withTestAccount(callback: (fixtures: TestAccountFixtures) => Promise<void>) {
    return globalFixtures.withFreshAccount(async (fixtures) => {
        await fixtures.enableFeatures(
            [FEATURE_GROUP_OWNERS]
        );
        await callback(fixtures);
    });
}

describe("getManageableGroups", () => {
    it("can be called by the backend", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create()
            const userService = await userFactory.createBackend();
            await userService.getManageableGroups(fixtures.getAccountId(), user.id);
        });
    });

    it("can be called by the user for itself", () => {
        return withTestAccount(async (fixtures) => {
            const user = await fixtures.users.create()
            const userService = await userFactory.createForFrontend(user.id)
            await userService.getManageableGroups(fixtures.getAccountId(), user.id);
        });
    });

    it("can be called by the admin", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const admin = await fixtures.users.createAdmin();
            const userService = await userFactory.createForFrontend(admin.id)
            await userService.getManageableGroups(fixtures.getAccountId(), admin.id);
        });
    });

    it("can't be called by a regular user for another user", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const otherUser = await fixtures.users.create();
            const userService = await userFactory.createForFrontend(otherUser.id)
            await expect(() => userService.getManageableGroups(fixtures.getAccountId(), user.id))
                .rejects.toThrow("authorization issue");
        });
    });
});