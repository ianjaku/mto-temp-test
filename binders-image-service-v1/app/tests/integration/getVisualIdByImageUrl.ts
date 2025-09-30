import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";


const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    ImageServiceClient,
    "v1"
);

let _imageClient;
async function getImageClient() {
    if (!_imageClient) {
        _imageClient = await clientFactory.createBackend();
    }
    return _imageClient;
}
const imagesToCleanup: [string, string][] = [];


describe("getVisualIdByImageUrl", () => {

    test("returns null on an invalid image id", async () => {
        return globalFixtures.withAnyAccount(async () => {
            const client = await getImageClient();
            const response = await client.getVisualIdByImageUrl("invalid-image-id");
            expect(response).toBeNull();
        });
    });

    test("returns an id from the url, if the url contains the url", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const doc = await fixtures.items.createDocument();
            await fixtures.items.addDocToRootCollection(doc.id);

            const imageId = await fixtures.images.uploadVisual(doc.id, [__dirname, "assets/testimage.jpg"]);

            const client = await getImageClient();

            const image = await client.getVisual(doc.id, imageId, { cdnnify: true });
            const randomFormatUrl = image.formatUrls[0];
            const lookedUpVisualId = await client.getVisualIdByImageUrl(randomFormatUrl.url);

            expect(lookedUpVisualId).toBe(imageId);

            imagesToCleanup.push([doc.id, imageId]);
        });
    });

    test("returns an id for an azure media service url", async () => {
        return globalFixtures.withAnyAccount(async fixtures => {
            const doc = await fixtures.items.createDocument({}, { addToRoot: true });

            const imageId = await fixtures.images.uploadVisual(doc.id, [__dirname, "assets/testvideo.mp4"]);
            const client = await getImageClient();
            const image = await client.getVisual(doc.id, imageId, { cdnnify: true });
            const imageUrl = image.formatUrls[0].url;

            const lookedUpVisualId = await client.getVisualIdByImageUrl(imageUrl);

            expect(lookedUpVisualId).toBe(imageId);

            imagesToCleanup.push([doc.id, imageId]);
        });
    });

    afterAll(async () => {
        const client = await getImageClient();
        for (const [docId, imageId] of imagesToCleanup) {
            await client.hardDeleteVisual(docId, imageId);
        }
    });

});
