import { MockProxy, any, anyFunction, mock } from "jest-mock-extended";
import {
    NotificationServiceContract,
    RoutingKeyType,
    ServiceNotificationType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    ProcessingStep,
    TranscodeVisualProcessingJob,
    VideoFormat,
    VideoFormatType,
    VisualStatus
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { StreamingInfo, SupportedVideoCodec, Video, VideoIdentifier } from "../../src/api/model";
import { UpdateVisualProcessingFn, VideoProcessor } from "../../src/api/video/VideoProcessor";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ScreenshotHandler } from "../../src/processing/ScreenshotHandler";
import { TranscodeFailError } from "../../src/visualhandlers/bitmovin/bitmovin";
import { VisualHandler } from "../../src/visualhandlers/contract";
import { VisualProcessingJobsRepository } from "../../src/api/repositories/visualProcessingJobsRepository";
import { VisualRepository } from "../../src/api/repositories/contract";
import { mockWithFailure } from "../util/mocks";

const VIDEO_URL = "video_url";
jest.mock("../../src/storage/azure/AzureURLBuilder", () => ({
    buildOriginalVideoAzureURL: () => VIDEO_URL,
}));

const visualHandler: MockProxy<VisualHandler> = mockWithFailure<VisualHandler>("VisualHandler");
jest.mock("../../src/api/visualhandlers", () => ({
    VisualHandlers: {
        get: () => visualHandler,
    }
}));

const ACCOUNT_ID = "aid-account";
const BINDER_ID = "bid-binder";
const VIDEO_ID = "vid-video";
const VIDEO_PATH = "/video/path";

const VIDEO = {
    id: VideoIdentifier.parse(VIDEO_ID),
    binderId: BINDER_ID,
    formats: [
        {
            format: VideoFormatType.ORIGINAL,
            width: 640,
            height: 480,
            size: 1000,
            videoCodec: SupportedVideoCodec.H264,
            audioCodec: null,
            hasAudio: false,
            storageLocation: "",
            container: "ff",
        }
    ]
} as Video;

const TRANSCODE_JOB: TranscodeVisualProcessingJob = {
    visualId: VIDEO_ID,
    step: ProcessingStep.TRANSCODING,
    created: new Date(),
    updated: new Date(),
    accountId: ACCOUNT_ID,
    stepDetails: {
        encodingId: "EID",
        manifestPaths: [],
        thumbnailFormats: [],
    }
};

describe("videoProcessor", () => {
    let videoProcessor: VideoProcessor;
    let binderVisualRepository: MockProxy<VisualRepository>;
    let bindersConfig: MockProxy<BindersConfig>;
    let screenshotHandler: MockProxy<ScreenshotHandler>;
    let notificationServiceClient: MockProxy<NotificationServiceContract>;
    let updateVisualProcessing: UpdateVisualProcessingFn;
    let visualProcessingJobsRepository: MockProxy<VisualProcessingJobsRepository>;

    beforeEach(() => {
        binderVisualRepository = mockWithFailure("BinderVisualRepository");
        bindersConfig = mockWithFailure("ScreenshotHandler");
        screenshotHandler = mockWithFailure("MediaStorage");
        notificationServiceClient = mockWithFailure("NotificationServiceClient");
        updateVisualProcessing = jest.fn();
        visualProcessingJobsRepository = mockWithFailure("VisualProcessingJobsRepository");

        videoProcessor = new VideoProcessor(
            mock(),
            screenshotHandler,
            visualProcessingJobsRepository,
            notificationServiceClient,
            binderVisualRepository,
            bindersConfig,
            updateVisualProcessing,
        );
    });

    describe("takeInitialScreenShots", () => {
        afterEach(() => {
            jest.resetAllMocks();
        });

        it("should update visual with screenshot formats", async () => {
            const screenshotFormats = [mock<VideoFormat>()]
            screenshotHandler.takeInitialScreenshots
                .calledWith(any(), any(), any())
                .mockResolvedValueOnce(screenshotFormats);

            await videoProcessor.takeInitialScreenshots(VIDEO, VIDEO_PATH);

            expect(screenshotHandler.takeInitialScreenshots)
                .toHaveBeenCalledWith(VIDEO_PATH, VIDEO, VIDEO_URL);
            expect(updateVisualProcessing)
                .toHaveBeenCalledWith(
                    BINDER_ID,
                    VIDEO_ID,
                    screenshotFormats,
                    VisualStatus.PROCESSING_BACKGROUND,
                    { updateDuplicatedVisualsFormats: true },
                );
        });

        it("should throw an unrecoverable error", async () => {
            screenshotHandler.takeInitialScreenshots
                .calledWith(any(), any(), any())
                .mockRejectedValueOnce(new Error("unrecoverable"));

            await expect(videoProcessor.takeInitialScreenshots(VIDEO, VIDEO_PATH))
                .rejects.toThrow("unrecoverable");
        });
    });

    describe("doVideoTranscoding", () => {
        afterEach(() => {
            jest.resetAllMocks();
        });

        it("should update the visual and dispatch message on transcode completion", async () => {
            visualProcessingJobsRepository.transitionJob
                .calledWith(any(), any(), any())
                .mockResolvedValueOnce(undefined);
            const streamingInfo = mock<StreamingInfo>();
            visualHandler.transcode
                .calledWith(any(), any())
                .mockResolvedValueOnce({ streamingInfo: streamingInfo });
            notificationServiceClient.dispatch
                .calledWith(any(), any(), any())
                .mockReturnValueOnce(undefined);

            await videoProcessor.doVideoTranscoding(VIDEO, ACCOUNT_ID, true);

            expect(visualProcessingJobsRepository.transitionJob)
                .toHaveBeenCalledWith(VIDEO_ID, ProcessingStep.TRANSCODING, { accountId: ACCOUNT_ID });
            expect(visualHandler.transcode)
                .toHaveBeenCalledWith(VIDEO, anyFunction());
            expect(updateVisualProcessing)
                .toHaveBeenCalledWith(BINDER_ID, VIDEO_ID, [], VisualStatus.COMPLETED, { updateDuplicatedVisualsFormats: true }, streamingInfo);
            expect(notificationServiceClient.dispatch)
                .toHaveBeenCalledWith(
                    { type: RoutingKeyType.ACCOUNT, value: ACCOUNT_ID },
                    ServiceNotificationType.VIDEOPROCESSING_END,
                    { visualId: VIDEO_ID, accountId: ACCOUNT_ID, binderId: BINDER_ID }
                );
        });

        it("should update the visual on transcode failure", async () => {
            visualProcessingJobsRepository.transitionJob
                .calledWith(any(), any(), any())
                .mockResolvedValueOnce(undefined);
            visualHandler.transcode
                .calledWith(any(), any())
                .mockRejectedValueOnce(new TranscodeFailError("FAILURE"));
            binderVisualRepository.updateVisual
                .calledWith(any(), any(), any())
                .mockReturnValueOnce(undefined);
            visualProcessingJobsRepository.deleteJobForVisual
                .calledWith(any())
                .mockReturnValueOnce(undefined);

            await expect(videoProcessor.doVideoTranscoding(VIDEO, ACCOUNT_ID, true))
                .rejects.toThrow("FAILURE");

            expect(binderVisualRepository.updateVisual)
                .toHaveBeenCalledWith(BINDER_ID, { key: VIDEO_ID }, { status: VisualStatus.ERROR });
            expect(visualProcessingJobsRepository.deleteJobForVisual)
                .toHaveBeenCalledWith(VIDEO_ID);
        });

        it("should throw on unknown error", async () => {
            visualProcessingJobsRepository.transitionJob
                .calledWith(any(), any(), any())
                .mockRejectedValueOnce(new Error("FAILURE"));

            await expect(videoProcessor.doVideoTranscoding(VIDEO, ACCOUNT_ID, true))
                .rejects.toThrow("FAILURE");
        });
    });

    describe("resumeVideoTranscoding", () => {
        afterEach(() => {
            jest.resetAllMocks();
        });

        it("should update the visual and dispatch message on transcode completion", async () => {
            const streamingInfo = mock<StreamingInfo>();
            visualHandler.waitToCompleteTranscode
                .calledWith(any(), any(), any(), any(), any())
                .mockResolvedValueOnce({ streamingInfo: streamingInfo });
            notificationServiceClient.dispatch
                .calledWith(any(), any(), any())
                .mockReturnValueOnce(undefined);

            await videoProcessor.resumeVideoTranscoding(VIDEO, TRANSCODE_JOB, true);

            expect(visualHandler.waitToCompleteTranscode)
                .toHaveBeenCalledWith(VIDEO, "EID", [], [], anyFunction());
            expect(updateVisualProcessing)
                .toHaveBeenCalledWith(BINDER_ID, VIDEO_ID, [], VisualStatus.COMPLETED, { updateDuplicatedVisualsFormats: true }, streamingInfo);
            expect(notificationServiceClient.dispatch)
                .toHaveBeenCalledWith(
                    { type: RoutingKeyType.ACCOUNT, value: ACCOUNT_ID },
                    ServiceNotificationType.VIDEOPROCESSING_END,
                    { visualId: VIDEO_ID, accountId: ACCOUNT_ID, binderId: BINDER_ID }
                );
        });

        it("should update the visual on transcode failure", async () => {
            visualProcessingJobsRepository.transitionJob
                .calledWith(any(), any(), any())
                .mockResolvedValueOnce(undefined);
            visualHandler.waitToCompleteTranscode
                .calledWith(any(), any(), any(), any(), any())
                .mockRejectedValueOnce(new TranscodeFailError("FAILURE"));
            binderVisualRepository.updateVisual
                .calledWith(any(), any(), any())
                .mockReturnValueOnce(undefined);
            visualProcessingJobsRepository.deleteJobForVisual
                .calledWith(any())
                .mockReturnValueOnce(undefined);

            await expect(() => videoProcessor.resumeVideoTranscoding(VIDEO, TRANSCODE_JOB, true))
                .rejects.toThrow("FAILURE");

            expect(binderVisualRepository.updateVisual)
                .toHaveBeenCalledWith(BINDER_ID, { key: VIDEO_ID }, { status: VisualStatus.ERROR });
            expect(visualProcessingJobsRepository.deleteJobForVisual)
                .toHaveBeenCalledWith(VIDEO_ID);
        });

        it("should throw on unknown error", async () => {
            visualHandler.waitToCompleteTranscode
                .calledWith(any(), any(), any(), any(), any())
                .mockRejectedValueOnce(new Error("FAILURE"));

            await expect(videoProcessor.resumeVideoTranscoding(VIDEO, TRANSCODE_JOB, true))
                .rejects.toThrow("FAILURE");
        });
    });
});
