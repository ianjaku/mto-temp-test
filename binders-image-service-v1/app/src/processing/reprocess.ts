/* eslint-disable no-console */
import {
    ImageFormatType,
    VideoFormatType
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { Video, VideoFormat, Visual, isVideo } from "../api/model";
import { all, countBy, equals, identity } from "ramda";
import { ImageService } from "../api/service";
import { LegacyVideoStorage } from "../storage/legacyVideoStorage";
import { LocalFileCopy } from "../storage/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { VideoStorage } from "../storage/videoStorage";

export enum ReprocessPolicy {
    FORCE_ALL = "FORCE_ALL", // reprocess video
    MISSING = "MISSING", // reprocess video if any format is missing
    MISSING_REQUIRED = "MISSING_REQUIRED", // reprocess video if any required format is missing
    MISSING_STREAMING_OUTPUT_CONTAINERS = "MISSING_STREAMING_OUTPUT_CONTAINERS", // reprocess video if if there is no output asset found for the streaming formats (MT-3485)
    NOT_BITMOVIN_NATIVE = "NOT_BITMOVIN_NATIVE", // reprocess video if it has not been encoded by Bitmovin
}

const doLocalProcessing = (visual: Visual, service: ImageService) => {
    return async (localCopy: LocalFileCopy) => {
        return service.doVisualProcessing(visual, localCopy.path, null, {
            runInBackground: false,
        });
    }
}

const REQUIRED_VIDEO_FORMATS = [
    VideoFormatType.VIDEO_DEFAULT_HD,
    VideoFormatType.VIDEO_DEFAULT_SD,
    VideoFormatType.VIDEO_DEFAULT_LD,
];

const ALL_VIDEO_FORMATS = {
    [VideoFormatType.VIDEO_DEFAULT_HD]: 1,
    [VideoFormatType.VIDEO_DEFAULT_SD]: 1,
    [VideoFormatType.VIDEO_DEFAULT_LD]: 1,
    [VideoFormatType.VIDEO_IPHONE_HD]: 1,
    [VideoFormatType.VIDEO_SCREENSHOT]: 10,
    [VideoFormatType.VIDEO_SCREENSHOT_BIG]: 10,
    [VideoFormatType.VIDEO_SCREENSHOT_BIG_2]: 9,
    [VideoFormatType.VIDEO_SCREENSHOT_HUGE]: 9,
    [VideoFormatType.VIDEO_SCREENSHOT_MEDIUM]: 9,
    [VideoFormatType.ORIGINAL]: 1,

};

export const ALL_VIDEO_FORMATS_COUNT = Object.keys(ALL_VIDEO_FORMATS)
    .reduce((reduced, key) => reduced + ALL_VIDEO_FORMATS[key], 0);

const hasAllRequiredVideoFormats = (video: Video) => {
    const availableFormats: VideoFormatType[] = video.formats.map(f => f.format as VideoFormatType);
    return all(required => availableFormats.includes(required), REQUIRED_VIDEO_FORMATS);
}


export const hasAllVideoFormats = (video: Video, exact = false): boolean => {
    const availableFormats: VideoFormatType[] = video.formats.map(f => f.format as VideoFormatType);
    const countedFormats = countBy(identity, availableFormats);
    if (exact) {
        // if exact is true, the exact number of formats defined in ALL_VIDEO_FORMATS is expected, otherwise it's "at least"
        return equals(countedFormats, ALL_VIDEO_FORMATS);
    }
    const lacksFormats = Object.keys(ALL_VIDEO_FORMATS).some((videoFormatType) => {
        return countedFormats[videoFormatType] < ALL_VIDEO_FORMATS[videoFormatType];
    });
    return !lacksFormats;
}

const hasAllRequiredFormats = (visual: Visual) => {
    if (isVideo(visual)) {
        return hasAllRequiredVideoFormats(visual);
    }
    return true;
}


const hasAllFormats = (visual: Visual, includeStreaming: boolean) => {
    if (isVideo(visual)) {
        const hasManifestUrls = visual?.streamingInfo?.manifestPaths?.length > 0;
        return hasAllVideoFormats(visual) && (!includeStreaming || hasManifestUrls);
    }
    return true;
}

const isAzureVideo = (visual: Visual) => {
    const isAzureFormat = (format: VideoFormat) => {
        return format.storageLocation.startsWith(VideoStorage.getScheme()) ||
            format.storageLocation.startsWith(LegacyVideoStorage.getScheme());
    }
    if (isVideo(visual)) {
        return all(
            isAzureFormat,
            visual.formats as VideoFormat[]
        );
    }
    return false;
}

export type IReprocessOptions = {
    reprocessPolicy: ReprocessPolicy;
    includeStreaming?: boolean;
    dryRun?: boolean;
    v2ReuploadLegacy?: boolean;
};

export async function shouldReprocess(
    visual: Visual,
    service: ImageService,
    reprocessOptions: IReprocessOptions,
    logger: Logger,
): Promise<boolean> {

    if (visual.originalVisualData?.originalId) {
        logger.debug(`visual ${visual.id.value()} is a duplicated visual; checking shouldReprocess of original (${visual.originalVisualData.binderId}/${visual.originalVisualData.originalId})`, "shouldReprocess");
        const originalVisual = await service.loadVisual(
            visual.originalVisualData.binderId,
            visual.originalVisualData.originalId
        );
        return shouldReprocess(originalVisual, service, reprocessOptions, logger);
    }

    if (reprocessOptions.reprocessPolicy === ReprocessPolicy.FORCE_ALL) {
        return true;
    }

    if (reprocessOptions.reprocessPolicy === ReprocessPolicy.NOT_BITMOVIN_NATIVE) {
        const manifestPaths = (visual as Video).streamingInfo?.manifestPaths;
        if (!manifestPaths || manifestPaths.length === 0) {
            return true;
        }
        return !all(path => /^\/vid-/.test(path), manifestPaths);
    }

    if (reprocessOptions.reprocessPolicy === ReprocessPolicy.MISSING_REQUIRED) {
        const hasRequired = hasAllRequiredFormats(visual);
        if (hasRequired) {
            console.log(`Skipping visual ${visual.id.value()} (has required formats)`);
            return false;
        }
        return true;
    }

    if (reprocessOptions.reprocessPolicy === ReprocessPolicy.MISSING) {
        const hasAll = hasAllFormats(visual, reprocessOptions.includeStreaming);
        if (hasAll) {
            console.log(`Skipping visual ${visual.id.value()} (has all formats)`);
            return false;
        }
        return true;
    }

    console.log(`unknown reprocessPolicy ${reprocessOptions.reprocessPolicy}, flag as reprocessable`)
    return true;
}

export async function reprocessVisual(
    visual: Visual,
    service: ImageService,
    reprocessOptions: IReprocessOptions,
): Promise<boolean> {
    if (!isAzureVideo(visual) && !reprocessOptions.v2ReuploadLegacy) {
        console.log(`Skipping visual ${visual.id.value()} (not in Azure)`);
        return false;
    }
    console.log("Reprocessing video", visual.id.value());
    console.log("Current status:", visual.status);
    console.log("Format count:", visual.formats.length);
    console.log("reprocessOptions:", reprocessOptions);

    if (!(reprocessOptions.dryRun)) {
        const imageStorage = service.getImageStorage();
        const reprocessLocal = doLocalProcessing(visual, service);
        await imageStorage.withLocalCopy(visual, ImageFormatType.ORIGINAL, reprocessLocal);
    }

    // process.exit(0);
    return true;
}
