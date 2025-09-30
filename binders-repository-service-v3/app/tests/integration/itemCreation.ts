import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { createNewBinder } from "@binders/client/lib/binders/create";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);

const repoFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);

const routingClientFactory = new ClientFactory(
    config,
    RoutingServiceClient,
    "v1"
);

describe("Item creation from frontend", () => {

    it("succeeds in creating a new binder inside a collection", () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const bob = await fixtures.users.create();
            await fixtures.authorization.assignItemPermission(rootCollection.id, bob.id, [PermissionName.EDIT]);
            const repoService = await repoFactory.createForFrontend(bob.id);
            const binderClass = createNewBinder(fixtures.getAccountId(), "test doc", "nl");
            const binder = await repoService.createBinderInCollection(binderClass, rootCollection.id, fixtures.getAccountId());
            expect(binder?.id).toBeDefined();
        });
    });

    it("succeeds in creating a new collection inside a collection", () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const bob = await fixtures.users.create();
            await fixtures.authorization.assignItemPermission(rootCollection.id, bob.id, [PermissionName.EDIT]);
            const repoService = await repoFactory.createForFrontend(bob.id);
            const collection = await repoService.createCollectionInCollection(
                fixtures.getAccountId(),
                rootCollection.id,
                "test col",
                "nl",
                { medium: DEFAULT_COVER_IMAGE, fitBehaviour: "fit", bgColor: "transparent" } as Thumbnail,
            );
            expect(collection?.id).toBeDefined();

            const routingClient = await routingClientFactory.createBackend();
            const collectionSemanticLinks = await routingClient.findSemanticLinks(collection.id);
            expect(collectionSemanticLinks.length).toBe(1);
        });
    });

    it("doesn't authorized creating a new binder in a collection user cannot edit", () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const bob = await fixtures.users.create();
            const repoService = await repoFactory.createForFrontend(bob.id);
            const binderClass = createNewBinder(fixtures.getAccountId(), "test doc", "nl");
            await expect(repoService.createBinderInCollection(binderClass, rootCollection.id, fixtures.getAccountId()))
                .rejects.toThrow("authorization issue (401)");
        });
    });

    it("doesn't authorized creating a new collection in a collection user cannot edit", () => {
        return globalFixtures.withAnyAccount(async (fixtures) => {
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            const bob = await fixtures.users.create();
            const repoService = await repoFactory.createForFrontend(bob.id);
            await expect(repoService.createCollectionInCollection(
                fixtures.getAccountId(),
                rootCollection.id,
                "test col",
                "nl",
                { medium: DEFAULT_COVER_IMAGE, fitBehaviour: "fit", bgColor: "transparent" } as Thumbnail,
            )).rejects.toThrow("authorization issue (401)");
        });
    });
});