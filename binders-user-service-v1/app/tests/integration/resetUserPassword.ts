import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);

describe("sendPasswordResetLinkTo", () => {
    it("throws when domain is unknown", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            await expect(client.sendPasswordResetLinkTo(["some-user@example.com"], fixtures.getAccountId(), "some-invalid-domain.com"))
                .rejects.toThrow("Unknown domain");
        });
    });
});
