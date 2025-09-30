import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import {
    FEATURE_DEVICE_LOGIN_PASSWORD
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const credFactory = new ClientFactory(
    config,
    CredentialServiceClient,
    "v1"
);
const TEST_PASSWORD = "open sesame";

describe("getImpersonatedSession", () => {

    it("returns a valid session without the password feature flag", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const device = await fixtures.users.create();
            const deviceTarget = await fixtures.users.create();
            await fixtures.users.setDeviceTargetUsers(device.id, [deviceTarget.id]);
            const credClient = await credFactory.createBackend();

            const result = await credClient.getImpersonatedSession(
                deviceTarget.id,
                fixtures.getAccountId(),
            );

            expect(result.userId).toBe(deviceTarget.id);
        });
    });

    describe("with password feature flag enabled", () => {
        it("returns a valid session when a correct password is provided", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_DEVICE_LOGIN_PASSWORD]);
                const device = await fixtures.users.create();
                const deviceTarget = await fixtures.users.create({ password: TEST_PASSWORD });
                await fixtures.users.setDeviceTargetUsers(device.id, [deviceTarget.id]);
                const credClient = await credFactory.createForFrontend(device.id);

                const result = await credClient.getImpersonatedSession(
                    deviceTarget.id,
                    fixtures.getAccountId(),
                    TEST_PASSWORD
                );

                expect(result.userId).toBe(deviceTarget.id);
            });
        });
        
        it("returns an error when no password is provided", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_DEVICE_LOGIN_PASSWORD]);
                const device = await fixtures.users.create();
                const deviceTarget = await fixtures.users.create();
                await fixtures.users.setDeviceTargetUsers(device.id, [deviceTarget.id]);
                const credClient = await credFactory.createForFrontend(device.id);

                expect(() => (
                    credClient.getImpersonatedSession(
                        deviceTarget.id,
                        fixtures.getAccountId(),
                    )
                )).rejects.toThrow("authorization issue (401)");
            });
        });

        it("returns an error when no password is provided", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_DEVICE_LOGIN_PASSWORD]);
                const device = await fixtures.users.create();
                const deviceTarget = await fixtures.users.create({ password: TEST_PASSWORD });
                await fixtures.users.setDeviceTargetUsers(device.id, [deviceTarget.id]);
                const credClient = await credFactory.createForFrontend(device.id);

                expect(() => (
                    credClient.getImpersonatedSession(
                        deviceTarget.id,
                        fixtures.getAccountId(),
                        "not the correct password"
                    )
                )).rejects.toThrow("authorization issue (401)");
            });
        });

        it("returns an error when the device target doesn't have a password", async () => {
            return globalFixtures.withFreshAccount(async fixtures => {
                await fixtures.enableFeatures([FEATURE_DEVICE_LOGIN_PASSWORD]);
                const device = await fixtures.users.create();
                const deviceTarget = await fixtures.users.create();
                await fixtures.users.setDeviceTargetUsers(device.id, [deviceTarget.id]);
                const credClient = await credFactory.createForFrontend(device.id);

                expect(() => (
                    credClient.getImpersonatedSession(
                        deviceTarget.id,
                        fixtures.getAccountId(),
                        "not the correct password"
                    )
                )).rejects.toThrow("authorization issue (401)");
            });
        });
    });
    
});
