import * as fs from "fs";
import {
    VideoFormat as ClientVideoFormat,
    ImageFormatType,
    VideoFormatType
} from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    SupportedAudioCodec,
    SupportedVideoCodec,
    VideoFormat,
    Visual,
    VisualFormat,
} from "../api/model";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LocalQueueWorker } from "./AzureScreenshotHandler";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { MediaStorage } from "../storage/contract";


const toClientFormat = (videoFormat: VideoFormat): ClientVideoFormat => {
    const clientFormat = {
        name: VideoFormatType[videoFormat.format],
        width: videoFormat.width,
        height: videoFormat.height,
        size: videoFormat.size,
        url: videoFormat.storageLocation,
        container: videoFormat.container,
    };
    if (videoFormat.durationInMs !== undefined && !Number.isNaN(videoFormat.durationInMs)) {
        clientFormat["durationInMs"] = videoFormat.durationInMs;
    }
    if (videoFormat.videoCodec !== undefined && SupportedVideoCodec[videoFormat.videoCodec] !== undefined) {
        clientFormat["videoCodec"] = SupportedVideoCodec[videoFormat.videoCodec].toLowerCase();
    }
    if (videoFormat.audioCodec !== undefined && SupportedAudioCodec[videoFormat.audioCodec] !== undefined) {
        clientFormat["audioCodec"] = SupportedAudioCodec[videoFormat.audioCodec].toLowerCase();
    }
    return clientFormat as ClientVideoFormat;
}

const category = "video-screenshot"

export class ScreenshotHandler {

    constructor(
        private readonly bindersConfig: BindersConfig,
        private readonly logger: Logger,
        private readonly storage: MediaStorage,
    ) {
    }

    public async takeScreenshotAt(
        visual: Visual,
        absoluteVideoPath: string,
        timemarkSec: number,
    ): Promise<ClientVideoFormat[]> {
        try {
            const newContainerName = await this.storage.createOutputAsset(visual.binderId, visual.id, 0);
            const newFormats = await this.takeAzureFuncScreenshot(
                undefined,
                visual,
                [
                    VideoFormatType.VIDEO_SCREENSHOT,
                ],
                newContainerName,
                absoluteVideoPath,
                timemarkSec
            );
            return newFormats.map(format => toClientFormat(format as VideoFormat));
        } catch (error) {
            this.logger.error(
                `error handling timed screenshot (visual id: "${visual.id.value()}")`,
                category,
                { error }
            );
            throw error;
        }
    }

    /**
     * Take an initial set of screenshots for a video.
     * This ensures that the client very quickly after uploading gets a thumbnail while the video is being processed in the background.
     * 
     * @param localPath The path of the original video on the machine
     * @param visual 
     * @param absoluteVideoPath An URL to the original video including necessary credentials
     */
    public async takeInitialScreenshots(
        localPath: string,
        visual: Visual,
        absoluteVideoPath: string,
    ): Promise<ClientVideoFormat[]> {
        try {
            const newContainerName = await this.storage.createOutputAsset(visual.binderId, visual.id, 0);
            const newFormats = await this.takeAzureFuncScreenshot(
                localPath,
                visual,
                [
                    VideoFormatType.VIDEO_SCREENSHOT,
                    VideoFormatType.VIDEO_SCREENSHOT_BIG,
                ],
                newContainerName,
                absoluteVideoPath
            );
            return newFormats.map(format => toClientFormat(format as VideoFormat));
        } catch (error) {
            this.logger.error(
                `error handling screenshot (visual id: "${visual.id.value()}")`,
                category,
                { error }
            );
            throw error;
        }
    }

    private async takeAzureFuncScreenshot(
        localPath: string,
        visual: Visual,
        formats: VideoFormatType[],
        newContainer: string,
        absoluteVideoPath: string,
        timemarkSec?: number,
    ): Promise<VisualFormat[]> {
        const azureHandler = new LocalQueueWorker(this.bindersConfig, this.logger);
        const screenshots = await this.withLocalOriginal(localPath, visual, localPath => (
            timemarkSec == null ?
                azureHandler.takeScreenshot(localPath, formats, newContainer, absoluteVideoPath) :
                azureHandler.takeScreenshotAt(absoluteVideoPath, formats, newContainer, timemarkSec)
        ));
        const scheme = await this.storage.getStorageScheme(visual.binderId, visual.id, VideoFormatType.ORIGINAL);
        return screenshots.map(({ Payload: s }) => ({
            format: s.format,
            width: s.width || parseInt(s.dimensions.split(":")[0]),
            height: s.height || parseInt(s.dimensions.split(":")[1]),
            size: s.size,
            storageLocation: `${scheme}${newContainer}/${s.formatName}`,
            container: newContainer,
            name: s.formatName,
        }));
    }

    /**
     * If localPath exists, then it will call "fn" with localPath
     * If localPath does not exist, then it will download a local copy, and call "fn" with the local copy
     */
    private withLocalOriginal<T>(
        localPath: string,
        visual: Visual,
        fn: (localPath: string) => Promise<T>
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            fs.exists(localPath, exists => {
                if (exists) {
                    resolve(fn(localPath));
                } else {
                    this.storage.withLocalCopy(visual, ImageFormatType.ORIGINAL, copy => fn(copy.path))
                        .then(resolve)
                        .catch(reject);
                }
            })
        });
    }
}
