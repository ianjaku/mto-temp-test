import {
    Binder,
    DocumentCollection
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FixOrphanItemsOptions,
    addSoftDeletedItemToRootCollection,
    deleteItems,
    findOrphans,
    fixOrphanItemsForAccount
} from  "../../../src/scripts/fixOrphanItems/fixOrphanItems";
import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { forEveryItemInAccount } from "../../../src/scripts/fixOrphanItems/forEveryItemInAccount";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);

const options: FixOrphanItemsOptions = { isDryRun: false };

describe("fixOrphanItemsForAccount", () => {

    it("Should not touch non-orphans", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const coll1 = await fixtures.items.createCollection();
            await fixtures.items.addCollToRootCollection(coll1.id);

            const doc1 = await fixtures.items.createDocument();
            await fixtures.items.addDocToRootCollection(doc1.id);

            const doc2 = await fixtures.items.createDocument();
            await fixtures.items.addDocToCollection(coll1.id, doc2.id);


            const account = await fixtures.getAccount();
            const fixedCount = await fixOrphanItemsForAccount(account.id, account.name, options);

            expect(fixedCount).toBe(0);
        });
    });

    it("Should delete empty collections", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const coll1 = await fixtures.items.createCollection();

            const account = await fixtures.getAccount();
            const fixedCount = await fixOrphanItemsForAccount(account.id, account.name, options);

            expect(fixedCount).toBe(1);

            const collections = await client.findCollections(
                { ids: [coll1.id], accountId: fixtures.getAccountId() },
                { maxResults: 2 }
            );
            expect(collections.length).toBe(0);
        });
    });

    it("Should delete binders with only 1 chunk", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument();

            const account = await fixtures.getAccount();
            const fixedCount = await fixOrphanItemsForAccount(account.id, account.name, options);

            expect(fixedCount).toBe(1);
            const docs = await client.findBindersBackend(
                { ids: [doc.id], accountId: fixtures.getAccountId() },
                { maxResults: 2 }
            );
            expect(docs.length).toBe(0);
        });
    });

    it("Should add binders with more chunks to the root collection", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument({ title: "some title", chunkTexts: ["chunk1", "chunk2"]});

            const normalDoc = await fixtures.items.createDocument();
            await fixtures.items.addDocToRootCollection(normalDoc.id);

            const account = await fixtures.getAccount();
            const fixedCount = await fixOrphanItemsForAccount(account.id, account.name, options);

            expect(fixedCount).toBe(1);
            const fetchedDoc = await client.getBinder(doc.id);
            expect(fetchedDoc).not.toBeNull();

            const ancestors = await client.getAncestors(doc.id);
            expect(ancestors[doc.id]).toHaveLength(1);
        });
    });

    it("Should add soft deleted binders to the root collection", async () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument({ title: "some title", chunkTexts: ["chunk1", "chunk2"]});
            await client.deleteBinder(doc.id, fixtures.getAccountId(), false);

            const account = await fixtures.getAccount();
            const fixedCount = await fixOrphanItemsForAccount(account.id, account.name, options);

            expect(fixedCount).toBe(1);
            const fetchedDoc = await client.getBinder(doc.id);
            expect(fetchedDoc).not.toBeNull();
            expect(fetchedDoc.deletionTime).toBeTruthy();

            const ancestors = await client.getAncestors(doc.id);
            expect(ancestors[doc.id]).toHaveLength(1);
        });
    });
});

describe("forEveryItemInAccount", () => {
    it("Should run binders first", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const coll = await fixtures.items.createCollection();
            const doc = await fixtures.items.createDocument();
            const rootColl = await fixtures.items.getOrCreateRootCollection();

            const allItems: (Binder | DocumentCollection)[] = [];
            await forEveryItemInAccount(fixtures.getAccountId(), async (items) => {
                items = items.filter(i => i.id !== rootColl.id);
                allItems.push(...items.filter(i => i.id !== rootColl.id));
            });

            expect(allItems.length).toBe(2);
            expect(allItems[0].id).toBe(doc.id);
            expect(allItems[1].id).toBe(coll.id);
        });
    });

    it("Should return newer collections first", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const coll1 = await fixtures.items.createCollection();
            const coll2 = await fixtures.items.createCollection();
            const rootColl = await fixtures.items.getOrCreateRootCollection();

            const allItems: (Binder | DocumentCollection)[] = [];
            await forEveryItemInAccount(fixtures.getAccountId(), async (items) => {
                items = items.filter(i => i.id !== rootColl.id);
                allItems.push(...items.filter(i => i.id !== rootColl.id));
            });

            expect(allItems.length).toBe(2);
            expect(allItems[0].id).toBe(coll2.id);
            expect(allItems[1].id).toBe(coll1.id);
        });
    });

    it("Should return children before parents, even when the parent has a later creation date", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const oldColl = await fixtures.items.createCollection();
            const newColl = await fixtures.items.createCollection();
            // const coll3 = await fixtures.items.createCollection();
            const rootColl = await fixtures.items.getOrCreateRootCollection();

            await fixtures.items.addCollToCollection(newColl.id, oldColl.id);

            const allItems: (Binder | DocumentCollection)[] = [];
            await forEveryItemInAccount(fixtures.getAccountId(), async (items) => {
                items = items.filter(i => i.id !== rootColl.id);
                allItems.push(...items.filter(i => i.id !== rootColl.id));
            });
            const getItemIndex = (id: string) => allItems.findIndex(i => i.id === id);

            expect(allItems.length).toBe(2);
            // Get oldColl first, because it's the child of newColl
            // and we always want to go bottom up
            expect(getItemIndex(oldColl.id)).toBe(0);
            expect(getItemIndex(newColl.id)).toBe(1);
        });
    });
})

describe("findOrphans", () => {
    it("Should return an item, if it is an orphan", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const doc = await fixtures.items.createDocument();
            const rootColl = await fixtures.items.getOrCreateRootCollection();

            const orphans = await findOrphans(rootColl.id, [doc]);

            expect(orphans.length).toBe(1);
        });
    });

    it("Should not return an item when it is not an orphan", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const doc = await fixtures.items.createDocument();
            const rootColl = await fixtures.items.getOrCreateRootCollection();
            await fixtures.items.addDocToRootCollection(doc.id);

            const orphans = await findOrphans(rootColl.id, [doc]);

            expect(orphans.length).toBe(0);
        });
    });
});

describe("addSoftDeletedItemToRootCollection", () => {
    it("Should make items no longer an orhpan", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const doc = await fixtures.items.createDocument();
            const rootColl = await fixtures.items.getOrCreateRootCollection();

            await addSoftDeletedItemToRootCollection(rootColl.id, [doc]);

            const orphans = await findOrphans(rootColl.id, [doc]);
            expect(orphans.length).toBe(0);
        });
    })
});

describe("deleteItems", () => {
    it("Should permanently delete items when permanent=true is passed", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument();
            const coll = await fixtures.items.createCollection();

            await deleteItems([doc, coll], true);

            const items = await client.findItems({
                accountId: fixtures.getAccountId(),
                ids: [doc.id, coll.id],
                softDelete: {
                    show: "show-all"
                }
            }, {
                maxResults: 2
            });
            expect(items.length).toBe(0);
        });
    });

    it("Should permenantly delete while scrolling", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument();
            const coll = await fixtures.items.createCollection();

            await forEveryItemInAccount(fixtures.getAccountId(), async (items) => {
                await deleteItems(items, true);
            });

            const items = await client.findItems({
                accountId: fixtures.getAccountId(),
                ids: [doc.id, coll.id],
                softDelete: {
                    show: "show-all"
                }
            }, {
                maxResults: 2
            });
            expect(items.length).toBe(0);
        });
    });

    it("Soft deletes when passed permanent=false", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument();
            const coll = await fixtures.items.createCollection();

            await forEveryItemInAccount(fixtures.getAccountId(), async (items) => {
                await deleteItems(items, false);
            });

            const items = await client.findItems({
                accountId: fixtures.getAccountId(),
                ids: [doc.id, coll.id],
                softDelete: {
                    show: "show-all"
                }
            }, {
                maxResults: 2
            });
            expect(items.length).toBe(2);
            expect(items[0].deletionTime).not.toBeNull();
            expect(items[1].deletionTime).not.toBeNull();
        });
    })

    it("Permanently deletes a soft deleted item", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument();
            const coll = await fixtures.items.createCollection();

            await forEveryItemInAccount(fixtures.getAccountId(), async (items) => {
                await deleteItems(items, false);
            });
            await forEveryItemInAccount(fixtures.getAccountId(), async (items) => {
                await deleteItems(items, true);
            });

            const items = await client.findItems({
                accountId: fixtures.getAccountId(),
                ids: [doc.id, coll.id],
                softDelete: {
                    show: "show-all"
                }
            }, {
                maxResults: 2
            });
            expect(items.length).toBe(0);
        });
    });

    it("Keeps items in the root collection, when they are soft deleted", () => {
        return globalFixtures.withFreshAccount(async fixtures => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument();
            const coll = await fixtures.items.createCollection();
            const rootColl = await fixtures.items.getOrCreateRootCollection();

            await forEveryItemInAccount(fixtures.getAccountId(), async (items) => {
                items = items.filter(i => i.id !== rootColl.id);
                await addSoftDeletedItemToRootCollection(rootColl.id, items);
                await deleteItems(items, false);
            });

            const orphans = await findOrphans(rootColl.id, [doc, coll]);
            expect(orphans.length).toBe(0);

            const items = await client.findItems({
                accountId: fixtures.getAccountId(),
                ids: [doc.id, coll.id],
                softDelete: {
                    show: "show-all"
                }
            }, {
                maxResults: 2
            });
            expect(items.length).toBe(2);
        });
    });
});
