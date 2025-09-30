import * as request from "superagent";
import {
    ImageFormatMaxDims,
    VideoFormatType
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { SCREENSHOTS_FORMATS, ScreenshotResult, visualFormatTypeToString } from "../api/model";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { VideoMetadata } from "../visualhandlers/contract";
import { enqueueScreenshot } from "../api/screenshotQueue";
import {
    getOrCreateLaunchDarklyService
} from "@binders/binders-service-common/lib/persistentcache/helpers/singletonDependencies";
import { getVideoMetadata } from "../metadata";

export interface AzureFunctionConfig {
    screenshotsLink: string;
}

type MetaType = {
    [format: number]: {
        path: string,
        format: VideoFormatType,
        dimensions: string,
    }
};

const CATEGORY = "local-queue-worker"
export class LocalQueueWorker {
    private screenshotsLink: string;

    constructor(private readonly bindersConfig: BindersConfig, private readonly logger: Logger) {
        this.screenshotsLink = this.bindersConfig.getString("azure.functions.screenshots").get();

        if (!this.screenshotsLink) {
            throw new Error("Config value azure.functions.screenshots not found when trying to build azure function config");
            
        }
    }

    public async takeScreenshotAt(
        absoluteVideoPath: string,
        formats: VideoFormatType[],
        srcKey: string,
        timemarkSec: number,
    ): Promise<ScreenshotResult> {
        const metadata = await getVideoMetadata(absoluteVideoPath);
        const aspect = metadata.width / metadata.height;
        const isLandscape = (metadata.width > metadata.height);
        const meta = isLandscape ?
            this.makeLandscapeScreenshotsMeta(metadata, aspect, formats) :
            this.makePortraitScreenshotsMeta(metadata, aspect, formats);
        // Ensure unique blob names by appending the timemark to the format key
        const safeTime = Math.round(timemarkSec); // worker currently only supports integer seconds
        const metaWithKeyframeNames = Object.entries(meta).reduce((out, [key, value]) => ({
            ...out,
            [`${key}_${safeTime}`]: value,
        }), {} as MetaType);
        return enqueueScreenshot(this.bindersConfig, this.logger, {
            targetPath: absoluteVideoPath,
            meta: metaWithKeyframeNames,
            timemark: safeTime,
            container: srcKey,
            tempFile: `${srcKey}.jpg`,
        });
    }

    public async takeScreenshot(
        originalVisualPath: string,
        formats: VideoFormatType[],
        srcKey: string,
        absoluteVideoPath: string
    ): Promise<ScreenshotResult> {
        const metadata = await getVideoMetadata(originalVisualPath);
        const aspect = metadata.width / metadata.height;
        const isLandscape = (metadata.width > metadata.height);
        const meta = isLandscape ?
            this.makeLandscapeScreenshotsMeta(metadata, aspect, formats) :
            this.makePortraitScreenshotsMeta(metadata, aspect, formats);
        const useScreenshotWorker = await this.getScreenshotWorkerFlag()
        if (useScreenshotWorker) {
            this.logger.info("Sending video data to screenshot worker", CATEGORY)
            return await this.sendScreenshotToWorker(absoluteVideoPath, meta, srcKey, this.calculateStartTimemark(metadata))
        }
        this.logger.info("Sending video data to Azure function", CATEGORY)
        const returnFunc = await this.sendScreenshotRequest(
            absoluteVideoPath,
            meta,
            srcKey,
            this.calculateStartTimemark(metadata)
        );
        return returnFunc
    }

    private async getScreenshotWorkerFlag() {
        try {
            const ldService = await getOrCreateLaunchDarklyService(this.bindersConfig)
            return await ldService.getFlag(LDFlags.SCREENSHOT_WORKER)            
        } catch (error) {
            this.logger.error(`Can't fetch ld flag: ${LDFlags.SCREENSHOT_WORKER}`, CATEGORY, error)
            return false
        }       
    }

    private async sendScreenshotRequest(
        absoluteVideoPath: string,
        meta: MetaType,
        srcKey: string,
        timemark: number,
    ): Promise<ScreenshotResult> {
        const payload = {
            targetPath: absoluteVideoPath,
            meta,
            tempFile: `${srcKey}.jpg`,
            timemark,
            container: srcKey,
            useNewStorage: true, // TODO coordinatte with Waldek to make TakeScreenshot function no longer need this
        }
        return new Promise((resolve, reject) => {
            request
                .post(this.screenshotsLink)
                // .post("http://172.17.0.1:7071/api/screenshots")
                .send(JSON.stringify(payload))
                .set("Content-Type", "application/json")
                .then(
                    res => {
                        const result = res && res.text && JSON.parse(res.text);
                        if (result) {
                            resolve(result);
                        } else {
                            reject(res);
                        }
                    },
                    err => {
                        reject(err)
                    }
                )
        });
    }

    private async sendScreenshotToWorker(
        targetPath: string,
        meta: MetaType,
        srcKey: string,
        timemark: number,
    ): Promise<ScreenshotResult> {
        const payload = {
            targetPath,
            meta,
            tempFile: `${srcKey}.jpg`,
            timemark,
            container: srcKey
        }
        return enqueueScreenshot(this.bindersConfig, this.logger, payload)
    }

    private getScreenshotsFormatsMaxDims(format: VideoFormatType): ImageFormatMaxDims {
        switch (format) {
            case VideoFormatType.VIDEO_SCREENSHOT_MEDIUM:
                return ImageFormatMaxDims.MEDIUM;
            case VideoFormatType.VIDEO_SCREENSHOT_BIG:
                return ImageFormatMaxDims.MEDIUM2;
            case VideoFormatType.VIDEO_SCREENSHOT_BIG_2:
                return ImageFormatMaxDims.BIG;
            case VideoFormatType.VIDEO_SCREENSHOT_HUGE:
                return ImageFormatMaxDims.HUGE;
            default:
                return ImageFormatMaxDims.THUMBNAIL;
        }
    }

    private makeScreenshotsMetaObject(targets?: VideoFormatType[]): MetaType {
        const formats = targets ? targets : SCREENSHOTS_FORMATS as VideoFormatType[];
        return formats.reduce((out, format) => ({
            ...out,
            [visualFormatTypeToString(format)]: {
                format,
                dimensions: undefined,
            }
        }), {} as MetaType);
    }

    private makeLandscapeScreenshotsMeta(
        metadata: VideoMetadata,
        aspect: number,
        targets?: VideoFormatType[],
    ): MetaType {
        const meta = this.makeScreenshotsMetaObject(targets);
        const formats = targets ? targets : SCREENSHOTS_FORMATS as VideoFormatType[];
        formats.forEach(format => {

            const maxDim = this.getScreenshotsFormatsMaxDims(format);
            const newWidth = Math.min(maxDim, metadata.width);
            const newHeight = Math.floor(newWidth / aspect);
            meta[visualFormatTypeToString(format)].dimensions = `${newWidth}x${newHeight}`;
            meta[visualFormatTypeToString(format)].format = format;
        });
        return meta;
    }

    private makePortraitScreenshotsMeta(
        metadata: VideoMetadata,
        aspect: number,
        targets?: VideoFormatType[],
    ): MetaType {
        const meta = this.makeScreenshotsMetaObject(targets);
        const formats = targets ? targets : SCREENSHOTS_FORMATS as VideoFormatType[];
        formats.forEach(format => {
            const maxDim = this.getScreenshotsFormatsMaxDims(format);
            const newHeight = Math.min(maxDim, metadata.height);
            const newWidth = Math.floor(newHeight * aspect);
            meta[visualFormatTypeToString(format)].dimensions = `${newWidth}x${newHeight}`;
            meta[visualFormatTypeToString(format)].format = format;
        });
        return meta;
    }

    private calculateStartTimemark(metadata: VideoMetadata): number {
        if (!metadata.durationInMs) {
            return 0;
        }
        const timestampInMs = Math.min(1000, metadata.durationInMs);
        return Math.floor(timestampInMs / 1000);
    }

}
