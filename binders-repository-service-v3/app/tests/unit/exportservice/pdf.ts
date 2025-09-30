import { IVisualFormatSpec, Video } from "@binders/client/lib/clients/imageservice/v1/contract";
import { IBinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { getScreenshotUrlsFromVisual } from "../../../src/exportservice/pdf/util";

describe("getScreenshotUrlsFromVisual", () => {
    it("returns a sorted list by keyFramePosition of bitmoving screenshots when available", () => {
        const formatSpecs: IVisualFormatSpec[] = [
            {
                url: "url-3",
                keyFramePosition: 5.7,
            } as unknown as IVisualFormatSpec,
            {
                url: "url-1",
                keyFramePosition: 2.3,
            } as unknown as IVisualFormatSpec,
            {
                url: "url-2",
                keyFramePosition: 4.1,
            } as unknown as IVisualFormatSpec,
            {
                url: "url-4",
            } as unknown as IVisualFormatSpec,
        ]
        const serviceVisual = {
            scheme: "video-v2:",
            formatUrls: formatSpecs
        } as unknown as Video;

        const screenshotUrls = getScreenshotUrlsFromVisual({} as IBinderVisual, serviceVisual, true, "", false, "");

        expect(screenshotUrls).toEqual(["url-1", "url-2", "url-3"]);
    });

    it("returns a list of pre-bitmovin screenshots when available", () => {
        const formatSpecs: IVisualFormatSpec[] = [
            {
                name: "VIDEO_SCREENSHOT_BIG",
                url: "url-1",
            } as unknown as IVisualFormatSpec,
            {
                name: "VIDEO_SCREENSHOT_BIG",
                url: "url-2",
            } as unknown as IVisualFormatSpec,
            {
                name: "VIDEO_SCREENSHOT_BIG",
                url: "url-3",
            } as unknown as IVisualFormatSpec,
            {
                url: "url-4",
            } as unknown as IVisualFormatSpec,
        ]
        const serviceVisual = {
            scheme: "video-v2:",
            formatUrls: formatSpecs
        } as unknown as Video;

        const screenshotUrls = getScreenshotUrlsFromVisual({} as IBinderVisual, serviceVisual, true, "", false, "");

        expect(screenshotUrls).toEqual(["url-1", "url-2", "url-3"]);
    });

    it("returns a list of legacy screenshots", () => {
        const visualId = "vid-123";
        const visualUrl = "visual-url";
        const binderId = "binder-123";
        const visual = {
            id: visualId,
            url: visualUrl,
        } as unknown as IBinderVisual;

        const serviceVisual = {
            scheme: "s3:",
            urlToken: "",
        } as unknown as Video;

        const screenshotUrls = getScreenshotUrlsFromVisual(visual, serviceVisual, true, "", false, binderId);

        expect(screenshotUrls.length).toEqual(9);
        for (let i = 1; i < screenshotUrls.length + 1; i++) {
            const expectedUrl = `${visualUrl}/screenshots/${binderId}/${visualId}/KEY_FRAME_${i}/VIDEO_SCREENSHOT_BIG`;
            expect(screenshotUrls.includes(expectedUrl)).toBe(true);
        }
    });
});
