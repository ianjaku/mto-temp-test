import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
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

describe("removeElementFromCollection", () => {

    it("removes parent permissions from document", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const userClient = await clientFactory.createForFrontend(user.id);
            const coll1 = await fixtures.items.createCollection({}, {addToRoot: true})
            const coll2 = await fixtures.items.createCollection({}, {addToRoot: true})
            const doc = await fixtures.items.createDocument();
            await fixtures.items.addDocToCollection(coll1.id, doc.id);
            await fixtures.items.addDocToCollection(coll2.id, doc.id);
            await fixtures.authorization.assignItemRole(coll1.id, user.id, "Editor");

            await userClient.updateBinder(doc);
            await fixtures.items.removeDocFromCollection(coll1.id, doc.id);
            await expect(async () => {
                await userClient.updateBinder(doc);
            }).rejects.toThrow("authorization issue");
        });
    });

    it("removes parent permissions from descendants", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const userClient = await clientFactory.createForFrontend(user.id);
            const grandParentCollection = await fixtures.items.createCollection({}, {addToRoot: true})
            const parentCollection = await fixtures.items.createCollection({});
            const otherUnimportantParentCollection = await fixtures.items.createCollection({}, {addToRoot: true})
            const doc = await fixtures.items.createDocument();
            await fixtures.items.addDocToCollection(parentCollection.id, doc.id);
            await fixtures.items.addCollToCollection(grandParentCollection.id, parentCollection.id);
            await fixtures.items.addCollToCollection(otherUnimportantParentCollection.id, parentCollection.id);
            await fixtures.authorization.assignItemRole(grandParentCollection.id, user.id, "Editor");

            await userClient.updateBinder(doc);
            await fixtures.items.removeCollFromCollection(grandParentCollection.id, parentCollection.id);
            await expect(async () => {
                await userClient.updateBinder(doc);
            }).rejects.toThrow("authorization issue");
        });
    });

});

describe("addElementToCollection", () => {
    it("is rejected when an instance of that item already exists there", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const collection = await fixtures.items.createCollection({}, { addToRoot: true });
            const collection2 = await fixtures.items.createCollection({}, { addToRoot: true });
            const document = await fixtures.items.createDocument();
            await fixtures.items.addDocToCollection(collection.id, document.id);
            await fixtures.items.addCollToCollection(collection.id, collection2.id);

            await expect(() => fixtures.items.addDocToCollection(collection.id, document.id))
                .rejects.toThrow("The path you selected already contains the item");

            await expect(() => fixtures.items.addCollToCollection(collection.id, collection2.id))
                .rejects.toThrow("The path you selected already contains the item");
        });
    });


    it("adds parent permissions to document", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const userClient = await clientFactory.createForFrontend(user.id);
            const coll = await fixtures.items.createCollection({}, {addToRoot: true})
            const doc = await fixtures.items.createDocument();
            await fixtures.authorization.assignItemRole(coll.id, user.id, "Editor");

            await expect(async () => {
                await userClient.updateBinder(doc);
            }).rejects.toThrow("authorization issue");
            await fixtures.items.addDocToCollection(coll.id, doc.id);
            await userClient.updateBinder(doc);
        });
    });

    it("adds parent permissions to descendants", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const userClient = await clientFactory.createForFrontend(user.id);
            const grandParentColl = await fixtures.items.createCollection({}, {addToRoot: true})
            const parentColl = await fixtures.items.createCollection({});
            const doc = await fixtures.items.createDocument();
            await fixtures.items.addDocToCollection(parentColl.id, doc.id);
            await fixtures.authorization.assignItemRole(grandParentColl.id, user.id, "Editor");

            await expect(async () => {
                await userClient.updateBinder(doc);
            }).rejects.toThrow("authorization issue");
            await fixtures.items.addDocToCollection(grandParentColl.id, parentColl.id);
            await userClient.updateBinder(doc);
        });
    });
});
