import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);

describe("cacheAvailableLanguages", () => {
    it("should get the available languages from the cache", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const client = await clientFactory.createForFrontend(user.id);

            // Potentially uncached
            const languagesByEngine = await client.getSupportedLanguagesByEngine();
            // Cached
            const cachedLanguageByEngine = await client.getSupportedLanguagesByEngine();
            // Guaranteed uncached
            const uncachedLanguagesByEngine = await client.getSupportedLanguagesByEngine(true);

            const compareResults = (left, right) => {
                const leftEngines = Object.keys(left);
                const rightEngines = Object.keys(right);
                expect(leftEngines.length).toEqual(rightEngines.length);

                for (const engine of leftEngines) {
                    const leftLanguages = left[engine];
                    const rightLanguages = right[engine];
                    expect(leftLanguages.length).toBeGreaterThan(0);
                    expect(leftLanguages.length).toEqual(rightLanguages.length);
                }
            }

            compareResults(languagesByEngine, cachedLanguageByEngine);
            compareResults(languagesByEngine, uncachedLanguagesByEngine);

        });
    })
})