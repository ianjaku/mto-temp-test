import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1",
);

describe("getAccountsForADTenant", () => {

    it("fetches the account when the tenant id is an url", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();

            const tenantId = "https://some-tenant-id.manual.to/";
            await client.setSSOSettings(fixtures.getAccountId(), {
                tenantId,
                enabled: true,
                certificateName: "",
                issuer: "",
                entryPoint: "",
            })
            const [account] = await client.getAccountsForADTenant(tenantId);
            expect(account).toBeDefined();
            expect(account.id).toEqual(fixtures.getAccountId());
        });
    });
});
