import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { VisualUsage } from "@binders/client/lib/clients/imageservice/v1/contract";
import { minutesToMilliseconds } from "date-fns";

const SIX_MINUTES_IN_MS = minutesToMilliseconds(6);

const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);

describe("rotatedVideos", () => {

    it("correctly rotates a video when its rotation metadata flag is set", async () => {
        return await globalFixtures.withAnyAccount(async fixtures => {
            const binder = await fixtures.items.createDocument();
            const visualId = await fixtures.images.uploadVisual(
                binder.id,
                [__dirname, "assets/testvideo-rotationflag.mp4"], // portrait video with a rotation flag set
                {
                    visualUsage: VisualUsage.BinderChunk,
                }
            );
            await fixtures.images.waitForCompleteProcessing(binder.id, [visualId]);
            const format = await fixtures.images.getVideoFormat(visualId, "VIDEO_SCREENSHOT", 0);
            expect(format.width).toBeGreaterThan(format.height); // results in a landscape video
        });
    }, SIX_MINUTES_IN_MS);

});
