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

describe("findPublications", () => {
    it("throws 404 when the binder does not exist", async () => {
        await globalFixtures.withFreshAccount(async () => {
            const repositoryClient = await clientFactory.createBackend();

            await expect(() => repositoryClient.findPublications("missing-binder-id", {}, {}))
                .rejects.toThrow("This item (missing-binder-id) does not exist. (404)")
        });
    });
});
