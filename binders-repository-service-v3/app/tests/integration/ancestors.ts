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

describe("ancestorIds", () => {
    it("should automatically be added to all new binders (if they exist in the document tree)", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const binder = await fixtures.items.createDocument({}, { addToRoot: true });
            const rootCollection = await fixtures.items.getOrCreateRootCollection();

            const fetchedBinder = await client.getBinder(binder.id);
            expect(fetchedBinder.ancestorIds).toEqual([rootCollection.id]);
        });
    });

    it("should automatically be added to all new collections (if they exist in the document tree)", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const collection = await fixtures.items.createCollection({}, { addToRoot: true });
            const rootCollection = await fixtures.items.getOrCreateRootCollection();

            const fetchedBinder = await client.getCollection(collection.id);
            expect(fetchedBinder.ancestorIds).toEqual([rootCollection.id]);
        });
    });

    it("should be updated when a binder is moved", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const binder = await fixtures.items.createDocument({}, { addToRoot: true });
            const coll = await fixtures.items.createCollection({}, { addToRoot: true });
            const rootCollection = await fixtures.items.getOrCreateRootCollection();
            await fixtures.items.addDocToCollection(coll.id, binder.id);
            await fixtures.items.removeDocFromCollection(rootCollection.id, binder.id);

            const fetchedBinder = await client.getBinder(binder.id);
            expect(fetchedBinder.ancestorIds.sort()).toEqual([rootCollection.id, coll.id].sort());
        });
    });

    it("should be updated when moved with nested binders", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const parentColl = await fixtures.items.createCollection({}, { addToRoot: true });
            const binder = await fixtures.items.createDocument({}, { addToCollId: parentColl.id });
            const grandParentColl = await fixtures.items.createCollection({}, { addToRoot: true });
            const rootCollection = await fixtures.items.getOrCreateRootCollection();

            await fixtures.items.addCollToCollection(grandParentColl.id, parentColl.id);
            await fixtures.items.removeCollFromCollection(rootCollection.id, parentColl.id);

            const fetchedParentColl = await client.getCollection(parentColl.id);
            expect(fetchedParentColl.ancestorIds.sort()).toEqual([rootCollection.id, grandParentColl.id].sort());

            const fetchedBinder = await client.getBinder(binder.id);
            expect(fetchedBinder.ancestorIds.sort()).toEqual([rootCollection.id, grandParentColl.id, parentColl.id].sort());
        });
    })
});