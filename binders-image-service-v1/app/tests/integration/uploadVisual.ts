/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { VisualStatus } from "@binders/client/lib/clients/imageservice/v1/contract";
import { minutesToMilliseconds } from "date-fns";

const FOUR_MINUTES_IN_MS = minutesToMilliseconds(4);

const config = BindersConfig.get();
const clientFactory = new ClientFactory(
    config,
    ImageServiceClient,
    "v1"
);
const globalFixtures = new TestFixtures(config);

let _imageClient;
async function getImageClient() {
    if (!_imageClient) {
        _imageClient = await clientFactory.createBackend();
    }
    return _imageClient;
}

describe("uploadVisuals", () => {
    it("correctly uploads an image", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const doc = await fixtures.items.createDocument({ languageCode: ["en"] }, { addToRoot: true });
            await fixtures.items.publishDoc(doc.id, ["en"]);
            await fixtures.images.uploadVisual(doc.id, [__dirname, "assets/testimage.jpg"]);

            const imageClient = await getImageClient();

            const visuals = await imageClient.listVisuals(doc.id);
            expect(visuals.length).toEqual(1);
            expect(visuals[0].status).toEqual(VisualStatus.COMPLETED);

            const formatNames = visuals[0].formats.map(f => f.name);
            for (const type of [
                "ORIGINAL",
                "MEDIUM",
                "THUMBNAIL",
                "MEDIUM2",
                "TINY",
            ]) {
                expect(formatNames).toContain(type);
            }
        });
    });

    it("uploads a sequential JPEG with corrupted Start of Scan (SOS) parameters", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const doc = await fixtures.items.createDocument({ languageCode: ["en"] }, { addToRoot: true });
            await fixtures.items.publishDoc(doc.id, ["en"]);
            await fixtures.images.uploadVisual(doc.id, [__dirname, "assets/corrupted_sos.jpg"]);

            const imageClient = await getImageClient();

            const visuals = await imageClient.listVisuals(doc.id);
            expect(visuals.length).toEqual(1);
            expect(visuals[0].status).toEqual(VisualStatus.COMPLETED);

            const formatNames = visuals[0].formats.map(f => f.name);
            for (const type of [
                "ORIGINAL",
                "MEDIUM",
                "THUMBNAIL",
                "TINY",
            ]) {
                expect(formatNames).toContain(type);
            }
        });
    });

    it("correctly uploads a video", async () => {
        return await globalFixtures.withFreshAccount(async fixtures => {
            const doc = await fixtures.items.createDocument({ languageCode: ["en"] }, { addToRoot: true });
            await fixtures.items.publishDoc(doc.id, ["en"]);
            const visualId = await fixtures.images.uploadVisual(doc.id, [__dirname, "assets/testvideo.mp4"]);
            await fixtures.images.waitForCompleteProcessing(doc.id, [visualId]);
        });
    }, FOUR_MINUTES_IN_MS);

});
