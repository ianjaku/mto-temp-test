import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { PublicApiServiceClient } from "@binders/client/lib/clients/publicapiservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    PublicApiServiceClient,
    "v1"
);

describe("generateApiToken", () => {
    it("Returns a string in UUID format", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const token = await client.generateApiToken(fixtures.getAccountId());
            expect(token).toMatch(/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i);
        });
    });

    it("Returns the same value as getApiToken", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const generatedToken = await client.generateApiToken(fixtures.getAccountId());
            const fetchedToken = await client.getApiToken(fixtures.getAccountId());
            expect(generatedToken).toEqual(fetchedToken);
        });
    });

    it("Invalidates previous tokens, and generates a new token every time", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const generatedToken1 = await client.generateApiToken(fixtures.getAccountId());
            const generatedToken2 = await client.generateApiToken(fixtures.getAccountId());
            const fetchedToken = await client.getApiToken(fixtures.getAccountId());
            expect(generatedToken1).not.toEqual(generatedToken2);
            expect(generatedToken2).toEqual(fetchedToken);
        });
    });

    it("Returns null when there is no token for the current user", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const token = await client.getApiToken(fixtures.getAccountId());
            expect(token).toBeNull();
        });
    });
});
