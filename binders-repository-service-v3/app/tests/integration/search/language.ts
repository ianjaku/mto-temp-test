import {
    doEditorSearch,
    doReaderSearch
} from  "@binders/binders-service-common/lib/testutils/searchHelpers";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { FEATURE_PUBLICCONTENT } from "@binders/client/lib/clients/accountservice/v1/contract";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    TestAccountFixtures
} from  "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { idOfSearchHit } from "@binders/client/lib/clients/repositoryservice/v3/helpers";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);

describe("Search collections and documents with a specific language", () => {

    async function createHelperTree(fixtures: TestAccountFixtures) {
        const col = await fixtures.items.createCollection({
            title: "Something interesting"
        });
        const doc1 = await fixtures.items.createDocument({
            title: "Search english",
            languageCode: "en",
            chunkTexts: ["Search something in english"]
        });
        const doc2 = await fixtures.items.createDocument({
            title: "Search french",
            languageCode: "fr",
            chunkTexts: ["Search something in french"]
        });
        const col1 = await fixtures.items.createCollection({
            title: "Search english col",
            languageCode: "en"
        });
        const col2 = await fixtures.items.createCollection({
            title: "Search french col",
            languageCode: "fr"
        });
        await fixtures.items.addCollToRootCollection(col.id);
        await fixtures.items.addDocToCollection(col.id, doc1.id)
        await fixtures.items.addDocToCollection(col.id, doc2.id)
        await fixtures.items.addCollToCollection(col.id, col1.id)
        await fixtures.items.addCollToCollection(col.id, col2.id)
        return {
            col1,
            col2,
            doc1,
            doc2,
            col
        }
    }

    it("shows up when inside the given scope", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const { col } = await createHelperTree(fixtures);
            const result = await doEditorSearch("search lang:en", fixtures.getAccountId(), col.id);
            expect(result.hits.length).toBe(2);
        });
    });

    it("shows up when outside the given scope", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const { col1 } = await createHelperTree(fixtures);
            const result = await doEditorSearch("search lang:en", fixtures.getAccountId(), col1.id);
            expect(result.hits.length).toBe(2);
        });
    });

    it("returns items when the full language name is used", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const { col } = await createHelperTree(fixtures);
            const result = await doEditorSearch("search lang:english", fixtures.getAccountId(), col.id);
            expect(result.hits.length).toBe(2);
        });
    })

    it("shows up when only the document title matches", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const doc1 = await fixtures.items.createDocument({
                title: "Search english",
                languageCode: "en",
                chunkTexts: ["doesn't match"]
            });
            await fixtures.items.addDocToRootCollection(doc1.id);
            const result = await doEditorSearch("search lang:en", fixtures.getAccountId());
            expect(result.hits.length).toBe(1);
        });
    });

    it("shows up when only a chunk matches", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const doc1 = await fixtures.items.createDocument({
                title: "Doesn't match",
                languageCode: "en",
                chunkTexts: ["Search something"]
            });
            await fixtures.items.addDocToRootCollection(doc1.id);
            const result = await doEditorSearch("search lang:en", fixtures.getAccountId());
            expect(result.hits.length).toBe(1);
        });
    });

    it("returns field hits for collections", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const col1 = await fixtures.items.createCollection({
                title: "Search",
                languageCode: "en"
            });
            await fixtures.items.addCollToRootCollection(col1.id);
            const result = await doEditorSearch("search lang:en", fixtures.getAccountId());
            expect(result.hits.length).toBe(1);
            const hit = result.hits[0];
            expect(hit.fieldHits.length).toBe(1);
            expect(hit.fieldHits[0].field).toBe("titles.title");
            expect(hit.fieldHits[0].contexts.length).toBe(1);
        });
    })

    it("returns binders with a dialect", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const doc = await fixtures.items.createDocument({
                title: "in british",
                languageCode: "en-GB",
                chunkTexts: ["Search something in british"]
            });
            await fixtures.items.addDocToRootCollection(doc.id);

            const result = await doEditorSearch("search lang:en", fixtures.getAccountId());

            expect(result.hits.length).toBe(1);
        })
    });

    it("returns binders with an exact dialect", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const doc = await fixtures.items.createDocument({
                title: "in british",
                languageCode: "en-GB",
                chunkTexts: ["Search something in british"]
            });
            await fixtures.items.addDocToRootCollection(doc.id);

            const result = await doEditorSearch("search lang:en-GB", fixtures.getAccountId());

            expect(result.hits.length).toBe(1);
        })
    });

    it("throws an error when the language is invalid", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await expect(async () => (
                await doEditorSearch("search lang:msioejfze", fixtures.getAccountId())
            )).rejects.toThrow();
        })
    })
});

describe("Search taking user permissions / edge cases into account", () => {

    it("doesn't return view-only items in the editor", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const readDoc = await fixtures.items.createDocument({ title: "search canread", languageCode: "en" }, { addToRoot: true });
            const editDoc = await fixtures.items.createDocument({ title: "search canedit", languageCode: "en" }, { addToRoot: true });
            await fixtures.items.publishDoc(readDoc.id, ["en"]);
            await fixtures.items.publishDoc(editDoc.id, ["en"]);
            await fixtures.authorization.assignItemPermission(readDoc.id, user.id, [PermissionName.VIEW]);
            await fixtures.authorization.assignItemPermission(editDoc.id, user.id, [PermissionName.EDIT]);
            await fixtures.authorization.assignItemPermission(editDoc.id, user.id, [PermissionName.VIEW]);

            const readerResult = await doReaderSearch("search", fixtures.getDomain(), undefined, user.id);
            const readerHitBinderIds = readerResult.hits.map(hit => hit["publicationSummary"]?.binderId);
            expect(readerResult.totalHitCount).toBe(2);
            expect(readerHitBinderIds).toContain(readDoc.id);
            expect(readerHitBinderIds).toContain(editDoc.id);
            const editorResult = await doEditorSearch("search", fixtures.getAccountId(), undefined, user.id);
            const editorHitIds = editorResult.hits.map(hit => idOfSearchHit(hit));
            expect(editorResult.totalHitCount).toBe(1);
            expect(editorHitIds).toContain(editDoc.id);
        });
    });

    it("doesn't return non-advertized items when searching publicly", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_PUBLICCONTENT]);
            const doc = await fixtures.items.createDocument({ title: "childrenofpubnonadv", languageCode: "en" });
            const col = await fixtures.items.createCollection({ title: "hiddencol", languageCode: "en" }, { addToRoot: true });
            await fixtures.items.addDocToCollection(col.id, doc.id);
            await fixtures.items.publishDoc(doc.id, ["en"]);
            await fixtures.authorization.grantPublicReadAccess(fixtures.getAccountId(), col.id);
            const readerResult_publicNonAdv = await doReaderSearch("childrenofpubnonadv", fixtures.getDomain(), undefined, undefined, true);
            expect(readerResult_publicNonAdv.totalHitCount).toBe(0);
            const readerResult_loggedIn = await doReaderSearch("childrenofpubnonadv", fixtures.getDomain(), undefined, undefined, false);
            expect(readerResult_loggedIn.totalHitCount).toBe(1);
            await fixtures.items.updateCollectionShowInOverview(col.id, true);
            const readerResult_publicAdv = await doReaderSearch("childrenofpubnonadv", fixtures.getDomain(), undefined, undefined, true);
            expect(readerResult_publicAdv.totalHitCount).toBe(1);
        });
    });

    it("doesn't return non-advertized items when searching publicly - ignores ancestor's showInOverview setting when it's not public anymore", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_PUBLICCONTENT]);
            const doc = await fixtures.items.createDocument({ title: "publicnonadvdoc", languageCode: "en" });
            const col = await fixtures.items.createCollection({ title: "col", languageCode: "en" }, { addToRoot: true });
            await fixtures.items.addDocToCollection(col.id, doc.id);
            await fixtures.items.publishDoc(doc.id, ["en"]);
            await fixtures.authorization.grantPublicReadAccess(fixtures.getAccountId(), doc.id);
            await fixtures.authorization.grantPublicReadAccess(fixtures.getAccountId(), col.id);
            await fixtures.items.updateCollectionShowInOverview(col.id, true);
            await fixtures.authorization.revokePublicReadAccess(fixtures.getAccountId(), col.id);
            const readerResult1 = await doReaderSearch("publicnonadvdoc", fixtures.getDomain(), undefined, undefined, true);
            expect(readerResult1.totalHitCount).toBe(0);
        });
    });

});

describe("editor search permissions", () => {

    it("returns all items when the user is an admin", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.items.createCollection({ title: "another document about search" }, { addToRoot: true });
            await fixtures.items.createDocument({ title: "search something" }, { addToRoot: true });
            const user = await fixtures.users.createAdmin();

            const result = await doEditorSearch("search", fixtures.getAccountId(), undefined, user.id);

            expect(result.hits.length).toBe(2);
        });
    });

    it("doesn't return items the user can't edit", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const doc1 = await fixtures.items.createDocument({ title: "another document about search" }, { addToRoot: true });
            const doc2 = await fixtures.items.createDocument({ title: "search something" }, { addToRoot: true });
            const doc3 = await fixtures.items.createDocument({ title: "search something, I'm giving up on you" }, { addToRoot: true });
            await fixtures.items.createDocument({ title: "another search bites the dust" }, { addToRoot: true });
            const user = await fixtures.users.create();
            await fixtures.authorization.assignItemRole(doc1.id, user.id, "Editor");
            await fixtures.authorization.assignItemRole(doc2.id, user.id, "Reader");
            await fixtures.authorization.assignItemRole(doc3.id, user.id, "Contributor");

            const result = await doEditorSearch("search", fixtures.getAccountId(), undefined, user.id);

            expect(result.hits.length).toBe(2);
        });
    });

});

describe("reader search permissions", () => {

    it("returns all items when the user is an admin", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.createAdmin();
            const coll = await fixtures.items.createCollection({ title: "another document about search" }, { addToRoot: true });
            await fixtures.items.createDocument(
                { title: "search something", languageCode: "en" },
                { addToCollId: coll.id, publish: true }
            );

            // Have to wait for collection.hasPublications to update
            await new Promise(r => setTimeout(r, 1000));

            const result = await doReaderSearch("search", fixtures.getDomain(), undefined, user.id);
            expect(result.hits.length).toBe(2);
        });
    });

    it("returns all items the user has read access to", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const doc1 = await fixtures.items.createDocument({ title: "something about search" }, { addToRoot: true, publish: true });
            await fixtures.authorization.assignItemRole(doc1.id, user.id, "Reader");
            const coll = await fixtures.items.createCollection({ title: "this one doesn't match" }, { addToRoot: true })
            await fixtures.authorization.assignItemRole(coll.id, user.id, "Editor");
            await fixtures.items.createDocument({ title: "this nested document does match 'search'"}, { addToCollId: coll.id, publish: true });

            const result = await doReaderSearch("search", fixtures.getDomain(), undefined, user.id);
            expect(result.hits.length).toBe(2);
        });
    });

    it("doesn't return items the user doesn't have read access to", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            await fixtures.items.createDocument({ title: "something about search" }, { addToRoot: true, publish: true });
            await fixtures.items.createCollection({ title: "this one doesn't match" }, { addToRoot: true })

            const result = await doReaderSearch("search", fixtures.getDomain(), undefined, user.id);

            expect(result.hits.length).toBe(0);
        });
    });

    it("returns items that are public & advertised when the user is not logged in", () => {
        return globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_PUBLICCONTENT]);
            const doc = await fixtures.items.createDocument({ title: "some searchable item"}, { addToRoot: true, publish: true });
            await fixtures.authorization.grantPublicReadAccess(fixtures.getAccountId(), doc.id);
            await fixtures.items.updateBinderShowInOverview(doc.id, true);

            const result = await doReaderSearch("searchable", fixtures.getDomain(), undefined, undefined, true);
            expect(result.hits.length).toBe(1);
        });
    });

});