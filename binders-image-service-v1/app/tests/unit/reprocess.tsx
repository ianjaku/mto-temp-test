import { Video, VideoFormat, VideoIdentifier } from "../../src/api/model";
import { VideoFormatType, VisualStatus, VisualUsage } from "@binders/client/lib/clients/imageservice/v1/contract";
import { hasAllVideoFormats } from "../../src/processing/reprocess";

const dummyFormatProps = { videoCodec: undefined, audioCodec: undefined, container: undefined, width: undefined, height: undefined, size: undefined, storageLocation: undefined };

const exactlyAllFormats: VideoFormat[] = [
    { format: VideoFormatType.VIDEO_DEFAULT_HD, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_DEFAULT_SD, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_DEFAULT_LD, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_IPHONE_HD, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG_2, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG_2, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG_2, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG_2, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG_2, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG_2, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG_2, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG_2, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG_2, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_HUGE, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_HUGE, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_HUGE, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_HUGE, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_HUGE, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_HUGE, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_HUGE, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_HUGE, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_HUGE, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_MEDIUM, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_MEDIUM, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_MEDIUM, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_MEDIUM, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_MEDIUM, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_MEDIUM, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_MEDIUM, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_MEDIUM, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_MEDIUM, ...dummyFormatProps },
    { format: VideoFormatType.ORIGINAL, ...dummyFormatProps },
];

const aFewExtraFormats = [
    ...exactlyAllFormats,
    { format: VideoFormatType.VIDEO_SCREENSHOT, ...dummyFormatProps },
    { format: VideoFormatType.VIDEO_SCREENSHOT_BIG, ...dummyFormatProps },
]

function buildDummyVid(formats: VideoFormat[]): Video {
    return {
        id: VideoIdentifier.generate(),
        binderId: "",
        filename: "",
        extension: "",
        md5: "",
        mime: "",
        status: VisualStatus.COMPLETED,
        created: new Date(),
        formats,
        fitBehaviour: "fit",
        bgColor: "",
        languageCodes: [],
        usage: VisualUsage.BinderChunk
    }
}

describe("reprocess helper tests", () => {
    it("should recognise all formats are present", () => {
        const hasAll = hasAllVideoFormats(buildDummyVid(exactlyAllFormats))
        expect(hasAll).toEqual(true);
    });
    it("should recognise that there are too many formats when exact flag is true", () => {
        const hasAll = hasAllVideoFormats(buildDummyVid(aFewExtraFormats), true)
        expect(hasAll).toEqual(false);
    });
    it("should recognise all formats are present when there are too many but exact flag is false", () => {
        const hasAll = hasAllVideoFormats(buildDummyVid(aFewExtraFormats), false)
        expect(hasAll).toEqual(true);
    });
});
