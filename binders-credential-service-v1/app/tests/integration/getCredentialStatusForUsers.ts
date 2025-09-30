import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { CredentialStatus } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { FEATURE_GROUP_OWNERS } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    TestAccountFixtures
} from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import {UserType} from "@binders/client/lib/clients/userservice/v1/contract";

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

async function withTestAccount( callback: (fixtures: TestAccountFixtures) => Promise<void>) {
    return globalFixtures.withFreshAccount(async (fixtures) => {
        await fixtures.enableFeatures([
            FEATURE_GROUP_OWNERS
        ]);
        await callback(fixtures);
    });
}

describe("Getting credential statuses for users", () => {
    it("Returns correct values based on permission and cred status when queries by group owner", async () => {
        return withTestAccount(async (fixtures) => {
            // Create user and set as group owner
            const groupOwner = await fixtures.users.create();
            const group = await fixtures.groups.create("test");
            const userClient = await userFactory.createBackend();
            await userClient.updateGroupOwners(fixtures.getAccountId(), group.id, [groupOwner.id]);

            // Create users (no password, password, not authorized)
            const userNotAuthorizedToSee = await fixtures.users.create();
            const userWithNoPassword = await fixtures.users.create();
            await fixtures.groups.addUserToGroup(group.id, userWithNoPassword.id);
            const userWithPassword = await fixtures.users.create();
            const beCredService = await credFactory.createBackend();
            await beCredService.createCredential(userWithPassword.id, userWithPassword.login, "xxxxxx");
            await fixtures.groups.addUserToGroup(group.id, userWithPassword.id);

            const allUserIds = [userWithNoPassword.id, userWithPassword.id, userNotAuthorizedToSee.id];

            const feCredService = await credFactory.createForFrontend(groupOwner.id);
            const credentialStatuses = await feCredService.getCredentialStatusForUsers(fixtures.getAccountId(), allUserIds);

            expect(credentialStatuses).toEqual(expect.objectContaining({
                [userWithNoPassword.id]: CredentialStatus.NO_PASSWORD,
                [userWithPassword.id]: CredentialStatus.PASSWORD_SET,
                [userNotAuthorizedToSee.id]: CredentialStatus.UNKNOWN,
            }))
        });
    });

    it("Returns correct values based on permission and cred status when queries by device user", async () => {
        return withTestAccount(async (fixtures) => {
            const deviceUser = await fixtures.users.create({ type: UserType.Device });

            // Create users (no password, password, not authorized)
            const userNotAuthorizedToSee = await fixtures.users.create();
            const userWithNoPassword = await fixtures.users.create();
            const userWithPassword = await fixtures.users.create();
            const userInGroupWithoutPassword = await fixtures.users.create();
            const groupAsTarget = await fixtures.groups.create();
            await fixtures.groups.addUserToGroup(groupAsTarget.id, userInGroupWithoutPassword.id);
            const beCredService = await credFactory.createBackend();
            await beCredService.createCredential(userWithPassword.id, userWithPassword.login, "xxxxxx");
            await fixtures.users.setDeviceTargetUsers(deviceUser.id, [userWithPassword.id, userWithNoPassword.id, groupAsTarget.id]);

            const allUserIds = [userWithNoPassword.id, userWithPassword.id, userNotAuthorizedToSee.id, userInGroupWithoutPassword.id];

            const feCredService = await credFactory.createForFrontend(deviceUser.id);
            const credentialStatuses = await feCredService.getCredentialStatusForUsers(fixtures.getAccountId(), allUserIds);

            expect(credentialStatuses).toEqual(expect.objectContaining({
                [userWithNoPassword.id]: CredentialStatus.NO_PASSWORD,
                [userWithPassword.id]: CredentialStatus.PASSWORD_SET,
                [userNotAuthorizedToSee.id]: CredentialStatus.UNKNOWN,
                [userInGroupWithoutPassword.id]: CredentialStatus.NO_PASSWORD,
            }))
        });
    });
});