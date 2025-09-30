/* eslint-disable no-console */
import { VisualStatus, VisualUsage } from "@binders/client/lib/clients/imageservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { log } from "@binders/binders-service-common/lib/util/process";
import { minutesToMilliseconds } from "date-fns";

const SIX_MINUTES_IN_MS = minutesToMilliseconds(6);

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const imageClientFactory = new ClientFactory(
    config,
    ImageServiceClient,
    "v1"
);

let _imageClient: ImageServiceClient;
async function getImageClient(): Promise<ImageServiceClient> {
    if (!_imageClient) {
        _imageClient = await imageClientFactory.createBackend();
    }
    return _imageClient;
}
const docsWithVisualsToCleanUp: string[] = [];

describe("feedbackAttachments", () => {

    it("rejects when too many visuals are attached to a comment", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const doc = await fixtures.items.createDocument({ languageCode: ["en"] }, { addToRoot: true });
            docsWithVisualsToCleanUp.push(doc.id);

            await fixtures.items.publishDoc(doc.id, ["en"]);
            await expect(() => fixtures.images.uploadVisuals(
                doc.id,
                [
                    [__dirname, "assets/same-image-diff-md5/testImage-1.svg"],
                    [__dirname, "assets/same-image-diff-md5/testImage-2.svg"],
                    [__dirname, "assets/same-image-diff-md5/testImage-3.svg"],
                    [__dirname, "assets/same-image-diff-md5/testImage-4.svg"],
                    [__dirname, "assets/same-image-diff-md5/testImage-5.svg"],
                    [__dirname, "assets/same-image-diff-md5/testImage-6.svg"],
                ],
                {
                    visualUsage: VisualUsage.ReaderComment,
                    commentId: "commentId-1",
                }
            )).rejects.toThrow("400");
        });
    });

    it("upload only once the duplicated visuals attached to a comment", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const doc = await fixtures.items.createDocument({ languageCode: ["en"] }, { addToRoot: true });
            docsWithVisualsToCleanUp.push(doc.id);

            await fixtures.items.publishDoc(doc.id, ["en"]);
            const visuals = await fixtures.images.uploadVisuals(
                doc.id,
                [
                    [__dirname, "assets/testimage.jpg"],
                    [__dirname, "assets/testimage.jpg"],
                ],
                {
                    visualUsage: VisualUsage.ReaderComment,
                    commentId: "commentId-1",
                }
            );
            expect(visuals.length).toBe(1);
        });
    });

    it("rejects visuals with unsupported format but keeps the valid ones", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const doc = await fixtures.items.createDocument({ languageCode: ["en"] }, { addToRoot: true });
            docsWithVisualsToCleanUp.push(doc.id);
            await fixtures.items.publishDoc(doc.id, ["en"]);

            await expect(() => fixtures.images.uploadVisuals(
                doc.id,
                [
                    [__dirname, "assets/testInvalidCodecVideo.avi"],
                    [__dirname, "assets/testimage.jpg"],
                ],
                {
                    visualUsage: VisualUsage.ReaderComment,
                    commentId: "commentId-1",
                }
            )).rejects.toThrow("415");
            const imageClient = await getImageClient();
            const visuals = await imageClient.getFeedbackAttachmentVisuals(doc.id);
            expect(visuals.length).toBe(1);
            expect(visuals[0].filename).toBe("testimage");
        });
    });

    it("upload an image feedback attachment and retrieve it again", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const doc = await fixtures.items.createDocument({ languageCode: ["en"] }, { addToRoot: true });
            docsWithVisualsToCleanUp.push(doc.id);
            await fixtures.items.publishDoc(doc.id, ["en"]);
            await fixtures.images.uploadVisual(
                doc.id,
                [__dirname, "assets/testimage.jpg"],
                {
                    visualUsage: VisualUsage.ReaderComment,
                    commentId: "commentId-1",
                }
            );
            const imageClient = await getImageClient();
            const feedbackAttachmentVisuals = await imageClient.getFeedbackAttachmentVisuals(doc.id);
            expect(feedbackAttachmentVisuals.length).toEqual(1);
            expect(feedbackAttachmentVisuals[0].commentId).toEqual("commentId-1");
        });
    });

    it("upload a video feedback attachment and retrieve it again", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const doc = await fixtures.items.createDocument({ languageCode: ["en"] }, { addToRoot: true });
            docsWithVisualsToCleanUp.push(doc.id);
            await fixtures.items.publishDoc(doc.id, ["en"]);

            const visualId = await fixtures.images.uploadVisual(
                doc.id,
                [__dirname, "assets/testvideo.mp4"],
                {
                    visualUsage: VisualUsage.ReaderComment,
                    commentId: "commentId-1",
                }
            );

            async function waitForComplete(msPassed = 0) {
                const imageClient = await getImageClient();
                const visual = await imageClient.getVisual(doc.id, visualId);
                const formatNames = visual.formats.map(f => f.name);
                if (visual.status === VisualStatus.COMPLETED) {
                    expect(visual.manifestUrls?.length).toBeGreaterThan(0);
                    for (const name of [
                        "ORIGINAL",
                        "VIDEO_SCREENSHOT",
                        // Disabling the following formats for now
                        // Until https://bindersmedia.atlassian.net/browse/MT-4449 is resolved
                        // "VIDEO_SCREENSHOT_MEDIUM",
                        "VIDEO_SCREENSHOT_BIG",
                        // "VIDEO_SCREENSHOT_BIG_2",
                        // "VIDEO_SCREENSHOT_HUGE",
                        // "VIDEO_DEFAULT_HD",
                        // "VIDEO_DEFAULT_SD",
                        // "VIDEO_DEFAULT_LD",
                        // "VIDEO_IPHONE_HD",
                    ]) {
                        expect(formatNames).toContain(name);
                    }
                    return;
                }
                if (msPassed > 300_000) {
                    log(`Incomplete visual ${JSON.stringify(visual, null, 4)}`)
                    throw new Error("Video didn't complete in 300 seconds");
                }
                console.log("waiting for video to complete processing...");
                await new Promise(resolve => setTimeout(resolve, 10000));
                await waitForComplete(msPassed + 10000);
            }

            const imageClient = await getImageClient();
            const feedbackAttachmentVisuals = await imageClient.getFeedbackAttachmentVisuals(doc.id);
            expect(feedbackAttachmentVisuals.length).toEqual(1);
            expect(feedbackAttachmentVisuals[0].commentId).toEqual("commentId-1");

            await waitForComplete();
        });
    }, SIX_MINUTES_IN_MS);

});
