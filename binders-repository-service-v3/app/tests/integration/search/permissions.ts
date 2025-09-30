import {
    doEditorSearch,
    doReaderSearch
} from  "@binders/binders-service-common/lib/testutils/searchHelpers";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { FEATURE_PUBLICCONTENT } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);

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