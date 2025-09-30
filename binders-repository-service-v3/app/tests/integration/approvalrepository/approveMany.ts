import { ApprovedStatus, Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { chunkIdFromIndex } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { create as createBinder } from  "@binders/client/lib/binders/custom/class";

const config = BindersConfig.get();
const clientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);
const globalFixtures = new TestFixtures(config);

async function withNewDocument(
    title: string,
    chunkTexts: string[],
    languageCodes: string[],
    callback: (client: BinderRepositoryServiceClient, doc: Binder) => Promise<void>
) {
    const client = await clientFactory.createBackend();
    await globalFixtures.withAnyAccount(async (fixtures) => {
        const doc = await fixtures.items.createDocument({
            title,
            chunkTexts,
            languageCode: languageCodes,
        });
        await fixtures.items.addDocToRootCollection(doc.id);
        await callback(client, doc);
    });
}

describe("approval", () => {
    it("approves a chunk on newly created document", async () => {
        await withNewDocument(
            "doc for approval",
            ["chunk #1", "chunk #2"],
            ["xx"],
            async (client, doc) => {
                const casBefore = await client.fetchApprovalsForBinder(doc.id);
                expect(casBefore).toHaveLength(0);

                await client.approveChunk(doc.id, "0", 0, "xx", ApprovedStatus.REJECTED);
                const casAfter = await client.fetchApprovalsForBinder(doc.id);
                expect(casAfter).toHaveLength(1);
                expect(casAfter[0].approved).toEqual("rejected");
            }
        );
    });

    it("approves all chunks on newly created document", async () => {
        await withNewDocument(
            "doc for approval",
            ["chunk #1", "chunk #2"],
            ["xx"],
            async (client, doc) => {
                const casBefore = await client.fetchApprovalsForBinder(doc.id);
                expect(casBefore).toHaveLength(0);

                await client.updateChunkApprovals(
                    doc.id,
                    { chunkIndices: [0, 1], chunkLanguageCodes: ["xx"] },
                    ApprovedStatus.APPROVED,
                );
                const casAfter = await client.fetchApprovalsForBinder(doc.id);
                expect(casAfter).toHaveLength(2);
            }
        );
    });

    it("updates only chunk approvals matching the approvalStatus filter", async () => {
        await withNewDocument(
            "doc for approval",
            ["chunk #1", "chunk #2", "chunk #3"],
            ["xx"],
            async (client, doc) => {
                const binder = createBinder(doc);

                const chunkId1 = chunkIdFromIndex(binder, 0);
                const chunkId2 = chunkIdFromIndex(binder, 1);
                const chunkId3 = chunkIdFromIndex(binder, 2);

                await client.approveChunk(doc.id, chunkId1, 0, "xx", ApprovedStatus.APPROVED);
                await client.approveChunk(doc.id, chunkId2, 0, "xx", ApprovedStatus.REJECTED);
                await client.approveChunk(doc.id, chunkId3, 0, "xx", ApprovedStatus.UNKNOWN);

                const casBefore = await client.fetchApprovalsForBinder(doc.id);
                expect(casBefore).toHaveLength(3);

                expect(casBefore.find(c => c.chunkId === chunkId1).approved).toEqual("approved"); // in reality: unknown
                expect(casBefore.find(c => c.chunkId === chunkId2).approved).toEqual("rejected");
                expect(casBefore.find(c => c.chunkId === chunkId3).approved).toEqual("unknown");

                await client.updateChunkApprovals(
                    doc.id,
                    {
                        chunkIndices: [0, 1, 2],
                        approvalStatus: ApprovedStatus.REJECTED,
                        chunkLanguageCodes: ["xx"],
                    },
                    ApprovedStatus.APPROVED,
                );

                const casAfter = await client.fetchApprovalsForBinder(doc.id);
                expect(casAfter).toHaveLength(3);
                expect(casAfter.find(c => c.chunkId === chunkId1).approved).toEqual("approved");
                expect(casAfter.find(c => c.chunkId === chunkId2).approved).toEqual("approved");
                expect(casAfter.find(c => c.chunkId === chunkId3).approved).toEqual("unknown");
            }
        );
    });

    it("updates all chunk approvals when approvalStatus is not specified in filter", async () => {
        await withNewDocument(
            "doc for approval",
            ["chunk #1", "chunk #2"],
            ["xx"],
            async (client, doc) => {
                const binder = createBinder(doc);

                const chunkId1 = chunkIdFromIndex(binder, 0);
                const chunkId2 = chunkIdFromIndex(binder, 1);

                await client.approveChunk(doc.id, chunkIdFromIndex(binder, 0), 0, "xx", ApprovedStatus.APPROVED);
                await client.approveChunk(doc.id, chunkIdFromIndex(binder, 1), 0, "xx", ApprovedStatus.UNKNOWN);

                const casBefore = await client.fetchApprovalsForBinder(doc.id);
                expect(casBefore).toHaveLength(2);
                expect(casBefore.find(c => c.chunkId === chunkId1).approved).toEqual("approved");
                expect(casBefore.find(c => c.chunkId === chunkId2).approved).toEqual("unknown");

                await client.updateChunkApprovals(
                    doc.id,
                    { chunkIndices: [0, 1], chunkLanguageCodes: ["xx"] },
                    ApprovedStatus.REJECTED,
                );

                const casAfter = await client.fetchApprovalsForBinder(doc.id);
                expect(casAfter).toHaveLength(2);
                expect(casAfter.find(c => c.chunkId === chunkId1).approved).toEqual("rejected");
                expect(casAfter.find(c => c.chunkId === chunkId2).approved).toEqual("rejected");
            }
        );
    });

    it("creates chunk approvals for chunks that had not been approved before", async () => {
        await withNewDocument(
            "doc for approval",
            ["chunk #1", "chunk #2"],
            ["xx"],
            async (client, doc) => {
                const binder = createBinder(doc);
                const chunkId1 = chunkIdFromIndex(binder, 0);
                const chunkId2 = chunkIdFromIndex(binder, 1);

                await client.approveChunk(doc.id, chunkIdFromIndex(binder, 0), 0, "xx", ApprovedStatus.APPROVED);

                const casBefore = await client.fetchApprovalsForBinder(doc.id);
                expect(casBefore).toHaveLength(1);
                expect(casBefore[0].approved).toEqual("approved");

                await client.updateChunkApprovals(
                    doc.id,
                    { chunkIndices: [0, 1], chunkLanguageCodes: ["xx"] },
                    ApprovedStatus.REJECTED,
                );

                const casAfter = await client.fetchApprovalsForBinder(doc.id);
                expect(casAfter).toHaveLength(2);
                expect(casAfter.find(c => c.chunkId === chunkId1).approved).toEqual("rejected");
                expect(casAfter.find(c => c.chunkId === chunkId2).approved).toEqual("rejected");
            }
        );
    });

    it("creates chunk approvals for all languages", async () => {
        await withNewDocument(
            "doc for approval",
            ["chunk #1", "chunk #2"],
            ["en", "de"],
            async (client, doc) => {
                const binder = createBinder(doc);
                const chunkId1 = chunkIdFromIndex(binder, 0);
                const chunkId2 = chunkIdFromIndex(binder, 1);

                await client.approveChunk(doc.id, chunkIdFromIndex(binder, 0), 0, "en", ApprovedStatus.APPROVED);

                const casBefore = await client.fetchApprovalsForBinder(doc.id);
                expect(casBefore).toHaveLength(1);
                expect(casBefore.find(c => c.chunkId === chunkId1 && c.chunkLanguageCode === "en"))
                    .toMatchObject({ approved: "approved" });

                await client.updateChunkApprovals(
                    doc.id,
                    { chunkIndices: [0, 1], chunkLanguageCodes: ["en", "de"] },
                    ApprovedStatus.REJECTED,
                );

                const casAfter = await client.fetchApprovalsForBinder(doc.id);
                expect(casAfter).toHaveLength(4);

                expect(casAfter.find(c => c.chunkId === chunkId1 && c.chunkLanguageCode === "en"))
                    .toMatchObject({ approved: "rejected" });

                expect(casAfter.find(c => c.chunkId === chunkId1 && c.chunkLanguageCode === "de"))
                    .toMatchObject({ approved: "rejected" });

                expect(casAfter.find(c => c.chunkId === chunkId2 && c.chunkLanguageCode === "en"))
                    .toMatchObject({ approved: "rejected" });

                expect(casAfter.find(c => c.chunkId === chunkId2 && c.chunkLanguageCode === "de"))
                    .toMatchObject({ approved: "rejected" });
            }
        );
    });
});