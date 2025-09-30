import { Binder, Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import hasDraft from "@binders/client/lib/util/hasDraft";

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    BinderRepositoryServiceClient,
    "v3"
);
const imageClientFactory = new ClientFactory(
    config,
    ImageServiceClient,
    "v1"
);

async function checkHasDraft(client: BinderRepositoryServiceClient, doc: Binder, languageCode?: string) {
    const publications = await client.findPublicationsBackend({ binderId: doc.id }, { maxResults: 1000 });
    return hasDraft(doc.modules.meta, languageCode, publications as Publication[]);
}

describe("hasDraft", () => {

    it("has a draft after a text change", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            let doc = await fixtures.items.createDocument({ languageCode: ["en", "nl"], title: "hi", chunkTexts: ["one"] }, { addToRoot: true });
            await fixtures.items.publishDoc(doc.id, ["nl"]);
            const hasDr = await checkHasDraft(client, doc, "nl");
            expect(hasDr).toBe(false);
            doc = await fixtures.items.updateBinderText(doc, "nl", "two");
            const hasADraft = await checkHasDraft(client, doc, "nl");
            expect(hasADraft).toBe(true);
        });
    });

    it("has a draft after an image change", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            const imageClient = await imageClientFactory.createBackend();
            let doc = await fixtures.items.createDocument({ languageCode: ["en", "nl"], title: "hi", chunkTexts: ["one"] }, { addToRoot: true });
            await fixtures.items.publishDoc(doc.id, ["nl"]);
            let hasADraft = await checkHasDraft(client, doc, "nl");
            expect(hasADraft).toBe(false);
            const visualId = await fixtures.images.uploadVisual(doc.id, [__dirname, "assets/logo.svg"]);
            const visual = await imageClient.getVisual(doc.id, visualId, { cdnnify: true });
            doc = await fixtures.items.updateBinderThumbnail(doc, visual);
            hasADraft = await checkHasDraft(client, doc, "nl");
            expect(hasADraft).toBe(true);
        });
    });

    it("has no draft in a non-changed language", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const client = await clientFactory.createBackend();
            let doc = await fixtures.items.createDocument(
                {
                    languageCode: ["en", "nl"],
                    title: "hi",
                    chunkTexts: ["one"]
                },
                {
                    addToRoot: true,
                    fetchFullDoc: true
                }
            );
            await fixtures.items.publishDoc(doc.id, ["nl", "en"]);
            doc = await fixtures.items.updateBinderText(doc, "nl", "two");
            const [hasNlDr, hasEnDr] = await Promise.all([
                checkHasDraft(client, doc, "nl"),
                checkHasDraft(client, doc, "en"),
            ]);
            expect(hasNlDr).toBe(true);
            expect(hasEnDr).toBe(false);
        });
    });

});
