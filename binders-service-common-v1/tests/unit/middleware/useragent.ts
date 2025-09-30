
import { parseUserAgent } from "../../../src/middleware/useragent";

describe("useragent parsing", () => {
    it("should parse a desktop useragent", async () => {
        const parsed = parseUserAgent("Mozilla/5.0 (X11; CrOS x86_64 10066.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36");
        expect(parsed.browser).toEqual("Chrome");
        expect(parsed.major).toEqual("127");
        expect(parsed.minor).toEqual("0");
        expect(parsed.patch).toEqual("0.0");
        expect(parsed.os).toEqual("Chromium OS 10066.0.0");

    });

    it("should parse a mobile useragent", async () => {
        const parsed = parseUserAgent("Mozilla/5.0 (Android 4.4; Mobile; rv:70.0) Gecko/70.0 Firefox/70.0");
        expect(parsed.deviceType).toEqual("mobile");
        expect(parsed.browser).toEqual("Firefox");
        expect(parsed.major).toEqual("70");
        expect(parsed.minor).toEqual("0");
        expect(parsed.patch).toEqual(undefined);
        expect(parsed.os).toEqual("Android 4.4");
    })

    it("should return undefined props for a useragent in unexpected format", async () => {
        const parsed = parseUserAgent("node-fetch (+https://github.com/node-fetch/node-fetch)");
        expect(parsed.deviceType).toEqual(undefined);
        expect(parsed.browser).toEqual(undefined);
        expect(parsed.major).toEqual(undefined);
        expect(parsed.minor).toEqual(undefined);
        expect(parsed.patch).toEqual(undefined);
        expect(parsed.os).toEqual(undefined);
    })
});
