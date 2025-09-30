import { BinderVisual } from "../../../src/clients/repositoryservice/v3/BinderVisual";
import { VisualKind } from "../../../src/clients/imageservice/v1/contract";

const urls = {
    dummy: "https://edge/url.jpg",
    original: "https://edge/url_original.jpg",
    big: "https://edge/url_big.jpg",
    medium: "https://edge/url_medium.jpg",
    thumbnail: "https://edge/url_thumbnail.jpg",
    topLvl: "https://edge/url_topLvl.jpg",
    ld: "https://edge/url_ld.jpg",
    sd: "https://edge/url_sd.jpg",
    hd: "https://edge/url_hd.jpg",
    videoScreenshot: "https://edge/url_videoScreenshot.jpg",
}

function buildVideoVisual(): BinderVisual {
    return Object.assign(Object.create(BinderVisual.prototype), {
        id: "vid-123",
        kind: VisualKind.VIDEO,
        url: urls.topLvl,
        formatUrls: [
            {
                width: 3000,
                height: 3000,
                name: "ORIGINAL",
                url: urls.original,
                isVideo: true,
            },
            {
                width: 3000,
                height: 3000,
                name: "VIDEO_SCREENSHOT",
                url: urls.videoScreenshot,
                isVideo: false,
            },
            {
                width: 300,
                height: 300,
                name: "VIDEO_DEFAULT_LD",
                url: urls.ld,
                isVideo: true,
            },
            {
                width: 1000,
                height: 1000,
                name: "VIDEO_DEFAULT_SD",
                url: urls.sd,
                isVideo: true,
            },
            {
                width: 1200,
                height: 1200,
                name: "VIDEO_DEFAULT_HD",
                url: urls.hd,
                isVideo: true,
            },
        ]
    });
}

function buildImageVisual(
    { excludeFormatUrls = false, } = {}
): BinderVisual {
    return Object.assign(Object.create(BinderVisual.prototype), {
        id: "img-123",
        kind: VisualKind.IMAGE,
        url: urls.topLvl,
        ...(excludeFormatUrls ? {} : {
            formatUrls: [
                {
                    width: 3000,
                    height: 3000,
                    name: "ORIGINAL",
                    url: urls.original,
                    isVideo: false,
                },
                {
                    width: 70,
                    height: 70,
                    name: "THUMBNAIL",
                    url: urls.thumbnail,
                    isVideo: false,
                },
                {
                    width: 200,
                    height: 200,
                    name: "MEDIUM",
                    url: urls.medium,
                    isVideo: false,
                },
                {
                    width: 1000,
                    height: 1000,
                    name: "BIG",
                    url: urls.big,
                    isVideo: false,
                },
            ]
        })
    });
}

describe("Test buildRenderUrl of Visual.ts", () => {
    it("returns literal url when provided", () => {
        const visual = buildImageVisual();
        const url = visual.buildRenderUrl({
            url: urls.dummy,
        })
        expect(url).toBe(urls.dummy);
    });
    it("returns a fallback url when the visual doesn't have formatUrls", async () => {
        const visual = buildImageVisual({ excludeFormatUrls: true })
        const url = visual.buildRenderUrl();
        expect(url).toBe(urls.topLvl);
    });
    it("returns first non-original video if forceLowResVideo is provided", async () => {
        const visual = buildVideoVisual();
        const url = visual.buildRenderUrl({ forceLowResVideo: true });
        expect(url).toBe(urls.ld);
    });
    it("returns a format specified with a requestedFormatUrlRegex", async () => {
        const visual = buildVideoVisual();
        const url = visual.buildRenderUrl({
            requestImage: true,
            bestFitOptions: {
                viewportDims: {
                    width: 180,
                    height: 180,
                },
                isLandscape: true,
            },
            requestedFormatUrlRegex: ".*/url_videoScreenshot.*",
        });
        expect(url).toBe(urls.videoScreenshot);
    });
    it("returns the requestedFormatName when provided", async () => {
        const visual = buildImageVisual();
        let url = visual.buildRenderUrl({
            requestedFormatNames: ["medium", "big"]
        });
        expect(url).toBe(urls.medium);
        url = visual.buildRenderUrl({
            requestedFormatNames: ["tiny", "medium"]
        });
        expect(url).toBe(urls.medium);
        url = visual.buildRenderUrl({
            requestedFormatNames: ["big", "huge"]
        });
        expect(url).toBe(urls.big);
    });
    it("returns the fallback url when no specific format/url is requested and no valid viewport dims are provided", async () => {
        const visual = buildImageVisual();
        const url = visual.buildRenderUrl({});
        expect(url).toBe(urls.topLvl);
    });
    it("returns a best-fit url when no specific format/url is requested and valid viewport dims are provided", async () => {
        const visual = buildImageVisual();
        const url = visual.buildRenderUrl({
            bestFitOptions: {
                viewportDims: {
                    width: 180,
                    height: 180,
                },
                isLandscape: true,
            }
        });
        expect(url).toBe(urls.medium);
    });
});