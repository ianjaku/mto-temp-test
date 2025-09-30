import {
    Format as ClientFormat,
    VideoFormat as ClientVideoFormat,
    ProcessingStep,
    TranscodeStepDetails,
    TranscodeVisualProcessingJob,
    VisualStatus
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { NotificationServiceContract, RoutingKeyType, ServiceNotificationType } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { StreamingInfo, Video, VisualIdentifier } from "../model";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ScreenshotHandler } from "../../processing/ScreenshotHandler";
import { TranscodeFailError } from "../../visualhandlers/bitmovin/bitmovin";
import { VisualHandlers } from "../visualhandlers";
import { VisualProcessingJobsRepository } from "../repositories/visualProcessingJobsRepository";
import { VisualRepository } from "../repositories/contract";
import { buildOriginalVideoAzureURL } from "../../storage/azure/AzureURLBuilder";

export type UpdateVisualProcessingFn = (
    binderId: string,
    visualId: string,
    formats: ClientFormat[],
    visualStatus: VisualStatus,
    options?: { updateDuplicatedVisualsFormats?: boolean },
    streamingInfo?: StreamingInfo,
) => Promise<void>;

const TAKE_SCREENSHOT_RETRY_MS = 5_000;

export class VideoProcessor {
    constructor(
        private readonly logger: Logger,
        private readonly screenshotHandler: ScreenshotHandler,
        private readonly visualProcessingJobsRepository: VisualProcessingJobsRepository,
        private readonly notificationServiceClient: NotificationServiceContract,
        private readonly binderVisualRepository: VisualRepository,
        private readonly bindersConfig: BindersConfig,
        private readonly updateVisualProcessing: UpdateVisualProcessingFn,
    ) {
    }

    async takeInitialScreenshots(
        video: Video,
        videoLocalPath: string,
    ): Promise<void> {
        const videoUrl = await buildOriginalVideoAzureURL(video, this.bindersConfig);
        const screenshotFormats = await this.getInitialScreenshotFormats(video, videoUrl, videoLocalPath);
        await this.updateVisualProcessing(
            video.binderId,
            video.id.value(),
            screenshotFormats,
            VisualStatus.PROCESSING_BACKGROUND,
            { updateDuplicatedVisualsFormats: true },
        );
    }

    private async getInitialScreenshotFormats(
        video: Video,
        videoUrl: string,
        videoLocalPath: string,
    ): Promise<ClientVideoFormat[]> {
        this.logger.debug("Processing video (screenshot)", "image-upload");
        const isVideoNotYetAvailableOnObjectStorage = err =>
            err.message?.includes("not a video") ||
            err.text?.includes("not a video") ||
            err.response?.text?.includes("not a video");

        for (let i = 0; i < 3; i++) {
            try {
                return await this.screenshotHandler.takeInitialScreenshots(videoLocalPath, video, videoUrl);
            } catch (err) {
                if (i < 2 && isVideoNotYetAvailableOnObjectStorage(err)) {
                    await new Promise(resolve => setTimeout(resolve, TAKE_SCREENSHOT_RETRY_MS));
                } else {
                    throw err;
                }
            }
        }
        throw new Error("Unreachable"); // TS complains otherwise
    }

    async doVideoTranscoding(
        video: Video,
        accountId: string,
        runInForeground = true,
    ): Promise<void> {
        const transcodingPromise = (async () => {
            try {
                await this.visualProcessingJobsRepository.transitionJob(video.id.value(), ProcessingStep.TRANSCODING, { accountId });
                const visualHandler = VisualHandlers.get(video.mime, this.logger);
                const { streamingInfo, formats = [] } = await visualHandler.transcode(
                    video,
                    this.buildTranscodeStepDetailsUpdateFn(video)
                );
                await this.completeVideoProcessing(video, formats, streamingInfo, accountId);
            } catch (error) {
                if (error instanceof TranscodeFailError) {
                    await this.failVideoProcessing(video.binderId, video.id.value(), error.message);
                }
                this.logger.error(`Failed to complete transcoding for video ${video.id.value()}: ${error.message}`, "video-transcode");
                if (runInForeground) {
                    throw error;
                }
            }
        })();
        if (runInForeground) {
            await transcodingPromise;
        }
    }

    private buildTranscodeStepDetailsUpdateFn(video: Video) {
        return async (stepDetails: TranscodeStepDetails): Promise<void> => {
            try {
                await this.visualProcessingJobsRepository.updateJobStepDetailsForVisual(video.id.value(), { stepDetails });
            } catch (error) {
                this.logger.error(`Could not update transcode state for visual ${video.id.value()}: ${error.message}`, "video-transcode");
            }
        };
    }

    private async completeVideoProcessing(
        originalVisual: Video,
        formats: ClientFormat[],
        streamingInfo: StreamingInfo,
        accountId: string
    ): Promise<void> {
        await this.updateVisualProcessing(
            originalVisual.binderId,
            originalVisual.id.value(),
            formats,
            VisualStatus.COMPLETED,
            { updateDuplicatedVisualsFormats: true },
            streamingInfo,
        );
        this.notificationServiceClient.dispatch(
            { type: RoutingKeyType.ACCOUNT, value: accountId },
            ServiceNotificationType.VIDEOPROCESSING_END,
            {
                visualId: originalVisual.id.value(),
                binderId: originalVisual.binderId,
                accountId,
            }
        );
    }

    private async failVideoProcessing(binderId: string, videoId: string, errorMessage: string): Promise<void> {
        this.logger.error(`Could not process visual: ${binderId}/${videoId}: ${errorMessage}`, "image-api");
        await this.binderVisualRepository.updateVisual(
            binderId,
            VisualIdentifier.parse(videoId),
            { status: VisualStatus.ERROR }
        );
        await this.visualProcessingJobsRepository.deleteJobForVisual(videoId);
    }

    async resumeVideoTranscoding(video: Video, processingJob: TranscodeVisualProcessingJob, runInForeground = true): Promise<void> {
        const transcodingPromise = (async () => {
            try {
                const visualHandler = VisualHandlers.get(video.mime, this.logger);
                const { streamingInfo, formats = [] } = await visualHandler.waitToCompleteTranscode(
                    video,
                    processingJob.stepDetails.encodingId,
                    processingJob.stepDetails.manifestPaths,
                    processingJob.stepDetails.thumbnailFormats,
                    this.buildTranscodeStepDetailsUpdateFn(video),
                );
                await this.completeVideoProcessing(video, formats, streamingInfo, processingJob.accountId);
            } catch (error) {
                if (error instanceof TranscodeFailError) {
                    await this.failVideoProcessing(video.binderId, video.id.value(), error.message);
                }
                this.logger.error(`Failed to resume background processing for visual ${video.id.value()}: ${error.message}`, "resume-video-transcode");
                if (runInForeground) {
                    throw error;
                }
            }
        })();
        if (runInForeground) {
            await transcodingPromise;
        }
    }
}