import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { FEATURE_CHECKLISTS } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);


describe("getChecklists", () => {

    it("returns an empty array when the given binder has no checklists", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument();

            const result = await client.getChecklists(doc.id);

            expect(result.length).toBe(0);
        });
    });

    it("returns a single checklist if the given binder has a single checklist", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_CHECKLISTS]);
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument({
                title: "some test title",
                languageCode: "en",
                chunkTexts: ["first chunk"]
            });
            await fixtures.items.addDocToRootCollection(doc.id);
            await fixtures.checklists.enableChecklistInDocument(doc, 0);

            const checklists = await client.getChecklists(doc.id);
            expect(checklists.length).toBe(1);
        });
    });

});

describe("getChecklistsActions", () => {

    it("passing a document without checklists returns an empty result", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument();

            const result = await client.getChecklistsActions([doc.id]);

            expect(result.length).toBe(0);
        });
    })

    /**
     * Two actions, one for checking the checklist and another for resetting the document
     */
    it("returns two actions when a doc with a single checklist gets filled", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_CHECKLISTS]);
            const client = await clientFactory.createBackend();
            const doc = await fixtures.items.createDocument({
                title: "some test title",
                languageCode: "en",
                chunkTexts: ["first chunk"]
            });
            await fixtures.items.addDocToRootCollection(doc.id);

            await fixtures.checklists.enableChecklistInDocument(doc, 0);

            const checklistId = await fixtures.checklists.getChecklistId(doc, 0);
            await client.togglePerformed(checklistId, true, doc.id, "");

            const result = await client.getChecklistsActions([doc.id]);
            expect(result.length).toBe(2);
        });
    });

    it("returns all actions inside of a collection", async () => {
        await globalFixtures.withFreshAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_CHECKLISTS]);
            const client = await clientFactory.createBackend();
            const col = await fixtures.items.createCollection();
            const doc1 = await fixtures.items.createDocument({
                title: "some test title",
                languageCode: "en",
                chunkTexts: ["first chunk"]
            });
            const doc2 = await fixtures.items.createDocument({
                title: "some test title",
                languageCode: "en",
                chunkTexts: ["first chunk"]
            });
            await fixtures.items.addDocToCollection(col.id, doc1.id);
            await fixtures.items.addDocToCollection(col.id, doc2.id);
            await fixtures.items.addCollToRootCollection(col.id);

            await fixtures.checklists.enableChecklistInDocument(doc1, 0);
            await fixtures.checklists.enableChecklistInDocument(doc2, 0);

            const checklistId1 = await fixtures.checklists.getChecklistId(doc1, 0);
            const checklistId2 = await fixtures.checklists.getChecklistId(doc2, 0);
            await client.togglePerformed(checklistId1, true, doc1.id, "");
            await client.togglePerformed(checklistId2, true, doc2.id, "");

            const result = await client.getChecklistsActions([col.id]);
            expect(result.length).toBe(4);
        });
    });
});

describe("getChecklistProgress", () => {
    it("calculates the number of checklists in certain state", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            await fixtures.enableFeatures([FEATURE_CHECKLISTS]);
            const client = await clientFactory.createBackend();
            const chunkTexts = ["first chunk", "second chunk", "third chunk"];
            const doc = await fixtures.items.createDocument({
                title: "some test title",
                languageCode: "en",
                chunkTexts
            });
            for (let chunkIndex = 0; chunkIndex < chunkTexts.length; chunkIndex++) {
                await fixtures.checklists.enableChecklistInDocument(doc, chunkIndex);
            }
            const [ checklistChunk0, checklistChunk1] = await client.getChecklists(doc.id);
            await client.togglePerformed(checklistChunk0.id, true, doc.id, "");
            await client.togglePerformed(checklistChunk1.id, true, doc.id, "");
            await client.togglePerformed(checklistChunk1.id, false, doc.id, "");

            const result = await client.getChecklistsProgress([doc.id]);

            expect(result.length).toBe(1);
            expect(result[0]).toMatchObject({
                binderId: doc.id,
                performed: 1,
                total: chunkTexts.length,
            })
        });
    })
})
