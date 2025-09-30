import { extractImageIdAndFormatFromUrl } from "@binders/client/lib/clients/imageservice/v1/visuals";

function testCase(url, result) {
    const [imageId] = extractImageIdAndFormatFromUrl(url);
    expect(imageId).toEqual(result);
}

describe("extracting the image id", () => {
    it("should find the right imge id", () => {
        testCase("http://api.binders.media/images/v1/binders/AVr3Dvnq7xU0aRIt-5cS/vid-7aa74910-767b-46c5-9ae8-b531b2d8ecaf/original", "vid-7aa74910-767b-46c5-9ae8-b531b2d8ecaf");
        testCase("https://api.binders.media/images/v1/binders/AVr3Dvnq7xU0aRIt-5cS/vid-7aa74910-767b-46c5-9ae8-b531b2d8ecaf/original", "vid-7aa74910-767b-46c5-9ae8-b531b2d8ecaf");
        testCase("http://api.binders.media/images/v1/binders/AVr3Dvnq7xU0aRIt-5cS/vid-7aa74910-767b-46c5-9ae8-b531b2d8ecaf/original", "vid-7aa74910-767b-46c5-9ae8-b531b2d8ecaf");
        testCase("http://api.binders.media/images/v1/binders/AVr3Dvnq7xU0aRIt-5cS/vid-7aa74910-767b-46c5-9ae8-b531b2d8ecaf/original", "vid-7aa74910-767b-46c5-9ae8-b531b2d8ecaf");
    });
    it("should return undefined if nothing matches", () => {
        testCase("https://s3.eu-central-1.amazonaws.com/binders/production/images/binder-images/AVWCF7yoKHzLSFuV5p5F/medium/58011cbff0bb0815002320c0.jpg", undefined);
    });
});