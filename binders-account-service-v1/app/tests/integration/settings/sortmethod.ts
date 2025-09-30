import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { AccountSortMethod } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const ALLOWED_SORT_METHODS = Object.values(AccountSortMethod) as string[];

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    AccountServiceClient,
    "v1"
);

describe("setAccountSortMethod", () => {

    it("throws an error when not one of " + ALLOWED_SORT_METHODS.join(", "), async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();

            await expect(async () => {
                await client.setAccountSortMethod(
                    fixtures.getAccountId(),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    "invalidsortmethod" as any
                );
            }).rejects.toThrow();
        });
    });

});

describe("getAccountSettings", () => {

    it("returns 'none' as the default sort method", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();

            const settings = await client.getAccountSettings(fixtures.getAccountId());

            expect(settings.sorting.sortMethod).toBe("none");
        });
    });

    it("returns 'alphabetical' when set to 'alphabetical'", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();

            await client.setAccountSortMethod(fixtures.getAccountId(), AccountSortMethod.Alphabetical);
            const settings = await client.getAccountSettings(fixtures.getAccountId());

            expect(settings.sorting.sortMethod).toBe(AccountSortMethod.Alphabetical);
        })
    });

});
