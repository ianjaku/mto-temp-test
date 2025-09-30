import {
    IOriginalVisualData,
    ProcessingStep,
    VideoFormatType,
    VisualProcessingJob,
    VisualStatus,
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { Matcher, MatcherCreator, MockProxy, mock } from "jest-mock-extended";
import { SupportedVideoCodec, Video, VideoFormat, VideoIdentifier, VisualIdentifier } from "../../src/api/model";
import { VisualRepository, VisualUpdate } from "../../src/api/repositories/contract";
import { subMinutes, subSeconds } from "date-fns";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ImageService } from "../../src/api/service";
import { MultiStorage } from "../../src/storage/multi";
import { NotificationServiceContract } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { URLBuilder } from "../../src/api/urls";
import { VideoProcessor } from "../../src/api/video/VideoProcessor";
import { VisualProcessingJobsRepository } from "../../src/api/repositories/visualProcessingJobsRepository";
import { VisualStorageDetails } from "binders-image-service-v1/app/src/storage/contract";
import { any } from "jest-mock-extended";
import { mockWithFailure } from "../util/mocks";

const BINDER_ID = "some-binder-id";
const ORIGINAL_BINDER_ID = "some-binder-id-original";
const VISUAL_ID = "vid-test";
const ORIGINAL_VISUAL_ID = "vid-test-original";
const ACCOUNT_ID = "aid-something";
const LOCAL_PATH = "some-local-path";

const videoProcessor = mockWithFailure<VideoProcessor>("VideoProcessor");
jest.mock("../../src/api/video/VideoProcessor", () => ({
    VideoProcessor: jest.fn().mockImplementation(() => {
        return videoProcessor;
    }),
}));

describe("restartVideoProcessing", () => {
    let imageService: ImageService;
    let binderVisualRepository: MockProxy<VisualRepository>;
    let notificationServiceClient: MockProxy<NotificationServiceContract>;
    let visualProcessingJobsRepository: MockProxy<VisualProcessingJobsRepository>;
    let imageStorage: MockProxy<MultiStorage>;
    let bindersConfig: MockProxy<BindersConfig>;

    beforeEach(() => {
        binderVisualRepository = mockWithFailure("BinderVisualRepository");
        notificationServiceClient = mockWithFailure("NotificationServiceClient");
        visualProcessingJobsRepository = mockWithFailure("VisualProcessingJobsRepository");
        imageStorage = mockWithFailure("ImageStorage");
        bindersConfig = mockWithFailure("BindersConfig");
        const urlBuilder = mock<URLBuilder>();

        imageService = new ImageService(
            mock(),
            binderVisualRepository,
            null,
            visualProcessingJobsRepository,
            imageStorage,
            null,
            urlBuilder,
            bindersConfig,
            null,
            null,
            notificationServiceClient,
            null,
            null,
        );
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("exists early when there is a job running for current visual", async () => {
        const visual = getVideo(VISUAL_ID, BINDER_ID, "vid-123");

        visualProcessingJobsRepository.findJobForVisual
            .calledWith(VISUAL_ID)
            .mockResolvedValueOnce(createAlreadyRunningJob(VISUAL_ID));

        await imageService.doVideoProcessing(visual, LOCAL_PATH, ACCOUNT_ID, {
            runInBackground: false,
        });
    });


    it("does not update the original format for a non-duplicated new storage video", async () => {
        const visual = getVideo(VISUAL_ID, BINDER_ID, "vid-123");

        visualProcessingJobsRepository.findJobForVisual
            .calledWith(VISUAL_ID)
            .mockResolvedValueOnce(null);
        visualProcessingJobsRepository.createJobForVisual
            .calledWith(VISUAL_ID, ProcessingStep.PREPROCESSING, matchObject({ accountId: ACCOUNT_ID }))
            .mockResolvedValueOnce(createNewJob(VISUAL_ID));

        binderVisualRepository.updateVisual
            .calledWith(visual.binderId, matchVisualId(VISUAL_ID), matchObject({ status: VisualStatus.PROCESSING }))
            .mockResolvedValueOnce(visual);
        videoProcessor.takeInitialScreenshots
            .calledWith(any(), any())
            .mockResolvedValueOnce(undefined);
        videoProcessor.doVideoTranscoding
            .calledWith(any(), any())
            .mockResolvedValueOnce(undefined);

        await imageService.doVideoProcessing(visual, LOCAL_PATH, ACCOUNT_ID, { runInBackground: false });
    });

    it("updates the original format for a non-duplicated old azure storage video", async () => {
        const visual = getVideo(VISUAL_ID, BINDER_ID, "asset-123");

        const storageDetails: VisualStorageDetails = {
            md5: "abd",
            format: new VideoFormat(
                VideoFormatType.ORIGINAL,
                visual.formats[0].width,
                visual.formats[0].height,
                visual.formats[0].size,
                visual.formats[0].videoCodec,
                visual.formats[0].audioCodec,
                visual.formats[0].storageLocation,
                visual.formats[0].container,
            ),
        };

        visualProcessingJobsRepository.findJobForVisual
            .calledWith(any())
            .mockResolvedValueOnce(null);
        visualProcessingJobsRepository.createJobForVisual
            .calledWith(any(), any(), any())
            .mockResolvedValueOnce(createNewJob(VISUAL_ID));

        imageStorage.addFile
            .calledWith(LOCAL_PATH, visual.binderId, matchVisualId(VISUAL_ID), visual.mime, VideoFormatType.ORIGINAL)
            .mockResolvedValueOnce(storageDetails);
        binderVisualRepository.updateVisual
            .calledWith(visual.binderId, matchVisualId(VISUAL_ID), matchReplaceFormatsVisualUpdate(storageDetails))
            .mockResolvedValueOnce(visual);

        binderVisualRepository.updateVisual
            .calledWith(visual.binderId, matchVisualId(VISUAL_ID), matchObject({ status: VisualStatus.PROCESSING }))
            .mockResolvedValueOnce(visual);
        videoProcessor.takeInitialScreenshots
            .calledWith(any(), any())
            .mockResolvedValueOnce(undefined);
        videoProcessor.doVideoTranscoding
            .calledWith(any(), any())
            .mockResolvedValueOnce(undefined);

        await imageService.doVideoProcessing(visual, LOCAL_PATH, ACCOUNT_ID, { runInBackground: false });

        expect(imageStorage.addFile).toHaveBeenCalledTimes(1);
        expect(binderVisualRepository.updateVisual).toHaveBeenCalledTimes(2);
    });

    it("updates the original format of the original file for a duplicated old azure storage video", async () => {
        const originalVisualData = {
            originalId: ORIGINAL_VISUAL_ID,
            binderId: ORIGINAL_BINDER_ID,
        };
        const visual = getVideo(VISUAL_ID, BINDER_ID, "asset-123", originalVisualData);
        const originalVisual = getVideo(ORIGINAL_VISUAL_ID, ORIGINAL_BINDER_ID, "asset-321");

        const storageDetails: VisualStorageDetails = {
            md5: "abd",
            format: new VideoFormat(
                VideoFormatType.ORIGINAL,
                visual.formats[0].width,
                visual.formats[0].height,
                visual.formats[0].size,
                visual.formats[0].videoCodec,
                visual.formats[0].audioCodec,
                visual.formats[0].storageLocation,
                visual.formats[0].container,
            ),
        };

        // Video job
        visualProcessingJobsRepository.findJobForVisual
            .calledWith(VISUAL_ID)
            .mockResolvedValueOnce(null);
        visualProcessingJobsRepository.createJobForVisual
            .calledWith(any(), any(), any())
            .mockResolvedValueOnce(createNewJob(VISUAL_ID));

        // Update original visual storage
        binderVisualRepository.getVisual
            .calledWith(ORIGINAL_BINDER_ID, matchVisualId(ORIGINAL_VISUAL_ID))
            .mockResolvedValueOnce(originalVisual);
        imageStorage.addFile
            .calledWith(LOCAL_PATH, ORIGINAL_BINDER_ID, matchVisualId(ORIGINAL_VISUAL_ID), originalVisual.mime, VideoFormatType.ORIGINAL)
            .mockResolvedValueOnce(storageDetails);
        binderVisualRepository.updateVisual
            .calledWith(originalVisual.binderId, matchVisualId(ORIGINAL_VISUAL_ID), matchReplaceFormatsVisualUpdate(storageDetails))
            .mockResolvedValueOnce(originalVisual);

        // Restart original stale job
        visualProcessingJobsRepository.transitionJob
            .calledWith(VISUAL_ID, ProcessingStep.PENDING_ON_VISUAL, matchObject({ linkedVisualId: ORIGINAL_VISUAL_ID }))
            .mockResolvedValueOnce(undefined);
        visualProcessingJobsRepository.findJobForVisual
            .calledWith(ORIGINAL_VISUAL_ID)
            .mockResolvedValueOnce(createStaleJob(ORIGINAL_BINDER_ID));
        visualProcessingJobsRepository.transitionJob
            .calledWith(ORIGINAL_VISUAL_ID, ProcessingStep.PREPROCESSING, matchObject({ accountId: ACCOUNT_ID }))
            .mockResolvedValueOnce(createNewJob(ORIGINAL_VISUAL_ID));

        binderVisualRepository.updateVisual
            .calledWith(originalVisual.binderId, matchVisualId(ORIGINAL_VISUAL_ID), matchObject({ status: VisualStatus.PROCESSING }))
            .mockResolvedValueOnce(originalVisual);
        videoProcessor.takeInitialScreenshots
            .calledWith(any(), any())
            .mockResolvedValueOnce(undefined);
        videoProcessor.doVideoTranscoding
            .calledWith(any(), any())
            .mockResolvedValueOnce(undefined);

        await imageService.doVideoProcessing(visual, LOCAL_PATH, ACCOUNT_ID, { runInBackground: false });

        expect(imageStorage.addFile).toHaveBeenCalledTimes(1);
        expect(binderVisualRepository.getVisual).toHaveBeenCalledTimes(1);
    });

    it("exists early when original video job is in progress", async () => {
        const originalVisualData = {
            originalId: ORIGINAL_VISUAL_ID,
            binderId: ORIGINAL_BINDER_ID,
        };
        const visual = getVideo(VISUAL_ID, BINDER_ID, "asset-123", originalVisualData);
        const originalVisual = getVideo(ORIGINAL_VISUAL_ID, ORIGINAL_BINDER_ID);

        visualProcessingJobsRepository.findJobForVisual
            .calledWith(VISUAL_ID)
            .mockResolvedValueOnce(null);
        visualProcessingJobsRepository.createJobForVisual
            .calledWith(VISUAL_ID, ProcessingStep.PREPROCESSING, matchObject({ accountId: ACCOUNT_ID }))
            .mockResolvedValueOnce(createNewJob(VISUAL_ID));

        binderVisualRepository.getVisual
            .calledWith(ORIGINAL_BINDER_ID, matchVisualId(ORIGINAL_VISUAL_ID))
            .mockResolvedValueOnce(originalVisual);

        visualProcessingJobsRepository.transitionJob
            .calledWith(VISUAL_ID, ProcessingStep.PENDING_ON_VISUAL, matchObject({ linkedVisualId: ORIGINAL_VISUAL_ID }))
            .mockResolvedValueOnce(undefined);
        visualProcessingJobsRepository.findJobForVisual
            .calledWith(ORIGINAL_VISUAL_ID)
            .mockResolvedValueOnce(createAlreadyRunningJob(ORIGINAL_VISUAL_ID));

        await imageService.doVideoProcessing(visual, LOCAL_PATH, ACCOUNT_ID, { runInBackground: false });
    });
});

const getVideo = (id: string, binderId: string, container = "video-v2://...", originalVisualData?: IOriginalVisualData): Video => ({
    id: VideoIdentifier.parse(id) as VideoIdentifier,
    binderId,
    created: new Date(),
    extension: "avi",
    filename: "somename.avi",
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
            container,
        }
    ],
    md5: "",
    mime: "",
    usage: undefined,
    status: VisualStatus.ACCEPTED,
    originalVisualData,
});

const createAlreadyRunningJob = (visualId: string): VisualProcessingJob => ({
    visualId,
    step: ProcessingStep.PREPROCESSING,
    accountId: ACCOUNT_ID,
    created: subMinutes(new Date(), 3),
    updated: subSeconds(new Date(), 30),
});

const createNewJob = (visualId: string): VisualProcessingJob => ({
    visualId,
    step: ProcessingStep.PREPROCESSING,
    accountId: ACCOUNT_ID,
    created: new Date(),
    updated: new Date(),
});

const createStaleJob = (visualId: string): VisualProcessingJob => ({
    visualId,
    step: ProcessingStep.TRANSCODING,
    accountId: ACCOUNT_ID,
    created: subMinutes(new Date(), 5),
    updated: subSeconds(new Date(), 90),
});

const matchVisualId: MatcherCreator<VisualIdentifier, string> = (expectedValue) =>
    new Matcher(actualValue => expectedValue === actualValue.value(), "Does not match");

const matchReplaceFormatsVisualUpdate: MatcherCreator<VisualUpdate, VisualStorageDetails> = (expectedValue) =>
    new Matcher(actualValue => {
        const actualVisualStorageDetails = actualValue.replaceFormats[0];
        return actualVisualStorageDetails.storageLocation === expectedValue.format.storageLocation &&
            actualVisualStorageDetails.container === expectedValue.format.container;
    }, "Not all the properties of the visual storage details were matched");

const matchObject: MatcherCreator<Record<string, unknown>, Record<string, unknown>> = (expectedValue) =>
    new Matcher(actualValue => {
        try {
            expect(expectedValue).toEqual(actualValue);
            return true;
        } catch (e) {
            return false;
        }
    }, "Objects don't 100% match");
