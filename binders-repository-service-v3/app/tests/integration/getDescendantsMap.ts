import {
    CollectionElement,
    IDescendantsMap
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
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


describe("getDescendantsMap", () => {

    it("returns the given collection if it's childless", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const coll = await fixtures.items.createCollection();
            await fixtures.items.addCollToRootCollection(coll.id);

            const client = await clientFactory.createBackend();
            const result = await client.getDescendantsMap(coll.id);

            compareDescendantsMap(result, {0: [{kind: "collection", key: coll.id}]});
        });
    });

    it("returns the given document with collection as kind", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const doc = await fixtures.items.createDocument();
            await fixtures.items.addDocToRootCollection(doc.id);

            const client = await clientFactory.createBackend();
            const result = await client.getDescendantsMap(doc.id);

            compareDescendantsMap(result, {0: [{kind: "collection", key: doc.id}]});
        });
    });

    it("returns both document and collection type children", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const mom = await fixtures.items.createCollection();
            const son = await fixtures.items.createDocument();
            const daughter = await fixtures.items.createCollection();
            await fixtures.items.addCollToRootCollection(mom.id);
            await fixtures.items.addCollToCollection(mom.id, daughter.id);
            await fixtures.items.addDocToCollection(mom.id, son.id);

            const client = await clientFactory.createBackend();
            const result = await client.getDescendantsMap(mom.id);

            compareDescendantsMap(result, {
                0: [{kind: "collection", key: mom.id}],
                1: [
                    {kind: "document", key: son.id},
                    {kind: "collection", key: daughter.id},
                ]
            })
        });

    });

    it("doesn't return items that are not in the given collection", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const coll = await fixtures.items.createCollection();
            const stranger1 = await fixtures.items.createDocument();
            const stranger2 = await fixtures.items.createCollection();
            await Promise.all([
                fixtures.items.addCollToRootCollection(coll.id),
                fixtures.items.addDocToRootCollection(stranger1.id),
                fixtures.items.addCollToRootCollection(stranger2.id),
            ]);

            const client = await clientFactory.createBackend();
            const result = await client.getDescendantsMap(coll.id);

            compareDescendantsMap(result, {0: [{kind: "collection", key: coll.id}]});
        });
    })
});


// Sort both maps and then compare
const sortDescendantsMap = (descendantsMap: IDescendantsMap) => {
    return Object.keys(descendantsMap).reduce((result, depth) => {
        result[depth] = [...descendantsMap[depth]].sort(
            (a: CollectionElement, b: CollectionElement) =>
                a.key.localeCompare(b.key)
        );
        return result;
    }, {...descendantsMap})
}

const compareDescendantsMap = (
    a: IDescendantsMap,
    b: IDescendantsMap
) => {
    const sortedA = sortDescendantsMap(a);
    const sortedB = sortDescendantsMap(b);
    expect(sortedA).toEqual(sortedB);
}