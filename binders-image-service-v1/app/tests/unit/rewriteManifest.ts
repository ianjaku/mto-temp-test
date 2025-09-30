import { addTokenToUrl, rewriteManifest } from "../../src/api/hlsProxy";


describe("rewriteManifest", () => {

    test("Urls in master manifest get rewritten", () => {
        const masterManifest = 
`
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=2665726,AVERAGE-BANDWIDTH=2526299,RESOLUTION=960x540,FRAME-RATE=29.970,CODECS="avc1.640029,mp4a.40.2",SUBTITLES="subtitles"
index_1.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3956044,AVERAGE-BANDWIDTH=3736264,RESOLUTION=1280x720,FRAME-RATE=29.970,CODECS="avc1.640029,mp4a.40.2",SUBTITLES="subtitles"
index_2.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=995315,AVERAGE-BANDWIDTH=951107,RESOLUTION=640x360,FRAME-RATE=29.970,CODECS="avc1.4D401E,mp4a.40.2",SUBTITLES="subtitles"
index_3.m3u8
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles",NAME="caption_1",DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,LANGUAGE="eng",URI="index_4_0.m3u8" 
`;
        const result = rewriteManifest(masterManifest, "https://example.com/master.m3u8", "auth-token", "https://image-service.com");
        expect(result).toEqual(
            `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=2665726,AVERAGE-BANDWIDTH=2526299,RESOLUTION=960x540,FRAME-RATE=29.970,CODECS="avc1.640029,mp4a.40.2",SUBTITLES="subtitles"
https://image-service.com/image/v1/hlsProxy/https%3A%2F%2Fexample.com%2Findex_1.m3u8/auth-token
#EXT-X-STREAM-INF:BANDWIDTH=3956044,AVERAGE-BANDWIDTH=3736264,RESOLUTION=1280x720,FRAME-RATE=29.970,CODECS="avc1.640029,mp4a.40.2",SUBTITLES="subtitles"
https://image-service.com/image/v1/hlsProxy/https%3A%2F%2Fexample.com%2Findex_2.m3u8/auth-token
#EXT-X-STREAM-INF:BANDWIDTH=995315,AVERAGE-BANDWIDTH=951107,RESOLUTION=640x360,FRAME-RATE=29.970,CODECS="avc1.4D401E,mp4a.40.2",SUBTITLES="subtitles"
https://image-service.com/image/v1/hlsProxy/https%3A%2F%2Fexample.com%2Findex_3.m3u8/auth-token
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles",NAME="caption_1",DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,LANGUAGE="eng",URI="https://image-service.com/image/v1/hlsProxy/https%3A%2F%2Fexample.com%2Findex_4_0.m3u8/auth-token" 
`
        );
    });

    test("#EXT-X-MAP:URI urls get rewritten", () => {
        const masterManifest = 
`
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MAP:URI="index_0.m3u8"
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=2665726,AVERAGE-BANDWIDTH=2526299,RESOLUTION=960x540,FRAME-RATE=29.970,CODECS="avc1.640029,mp4a.40.2",SUBTITLES="subtitles"
index_1.m3u8
`;
        const result = rewriteManifest(masterManifest, "https://example.com/master.m3u8", "auth-token", "https://image-service.com");
        expect(result).toEqual(
            `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MAP:URI="https://image-service.com/image/v1/hlsProxy/https%3A%2F%2Fexample.com%2Findex_0.m3u8/auth-token"
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=2665726,AVERAGE-BANDWIDTH=2526299,RESOLUTION=960x540,FRAME-RATE=29.970,CODECS="avc1.640029,mp4a.40.2",SUBTITLES="subtitles"
https://image-service.com/image/v1/hlsProxy/https%3A%2F%2Fexample.com%2Findex_1.m3u8/auth-token
`
        );
    });

    test("Urls in media manifest get rewritten", () => {
        const mediaManifest = 
`
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:7
#EXT-X-MEDIA-SEQUENCE:8779957
#EXTINF:6.006,
index_1_8779957.ts?m=1566416212
#EXTINF:6.006,
index_1_8779958.ts?m=1566416212
`
        const result = rewriteManifest(mediaManifest, "https://example.com/index_1.m3u8", "auth-token", "https://image-service.com");
        expect(result).toEqual(
            `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:7
#EXT-X-MEDIA-SEQUENCE:8779957
#EXTINF:6.006,
https://image-service.com/image/v1/hlsProxy/https%3A%2F%2Fexample.com%2Findex_1_8779957.ts%253Fm%3D1566416212/auth-token
#EXTINF:6.006,
https://image-service.com/image/v1/hlsProxy/https%3A%2F%2Fexample.com%2Findex_1_8779958.ts%253Fm%3D1566416212/auth-token
`);
    });
    
});

describe("addTokenToUrl", () => {

    test("Token is added to the url", () => {
        const urlWithToken = addTokenToUrl("https://example.com/test/index.m3u8", "sv=2022&se=moijzer%3A08%&sr=c");
        expect(urlWithToken).toEqual("https://example.com/test/index.m3u8?sv=2022&se=moijzer%3A08%&sr=c");
    });

    test("If the url already has a token, the token is not added", () => {
        const urlWithToken = "https://example.com/test/index.m3u8?sv=2022&se=moijzer%3A08%&sr=c";
        const resultUrl = addTokenToUrl(urlWithToken, "sv=2022&se=aoijzer%3A08%&sr=c");
        expect(resultUrl).toEqual(urlWithToken);
    });
    
});