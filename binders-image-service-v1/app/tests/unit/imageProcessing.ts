import { Format, ImageFormatType, VisualStatus } from "@binders/client/lib/clients/imageservice/v1/contract";
import { Image, ImageFormat, ImageIdentifier } from "../../src/api/model";
import { MockProxy, any, mock } from "jest-mock-extended";
import { ImageService } from "../../src/api/service";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { MultiStorage } from "../../src/storage/multi";
import { VisualRepository } from "../../src/api/repositories/contract";
import { mockWithFailure } from "../util/mocks";

const resizeImage = jest.fn();
jest.mock("../../src/processing/resizeImage", () => ({
    resizeImage: jest.fn().mockImplementation((...params) => resizeImage(...params)),
}));

const TEST_BINDER_ID = "bid-binder-id";
const TEST_IMG_ID = ImageIdentifier.parse("img-test-id") as ImageIdentifier;
const TEST_IMAGE = {
    id: TEST_IMG_ID,
    binderId: TEST_BINDER_ID,
    formats: [
    ]
} as Image;

describe("restartVideoProcessing", () => {
    let imageService: ImageService;
    let binderVisualRepository: MockProxy<VisualRepository>;
    let imageStorage: MockProxy<MultiStorage>;
    let logger: Logger;

    beforeEach(() => {
        binderVisualRepository = mockWithFailure("BinderVisualRepository");
        imageStorage = mockWithFailure("ImageStorage");
        logger = mock();

        imageService = new ImageService(
            logger,
            binderVisualRepository,
            null,
            null,
            imageStorage,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
        );
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("processes new image fails at resizing step", async () => {
        binderVisualRepository.updateVisual
            .calledWith(any(), any(), any())
            .mockResolvedValue(TEST_IMAGE);
        const error = new Error("test");
        resizeImage.mockRejectedValueOnce(error);

        await expect(() => imageService.doImageProcessing(TEST_IMAGE))
            .rejects.toThrow(error);

        expect(binderVisualRepository.updateVisual).toHaveBeenCalledTimes(2);
        expect(binderVisualRepository.updateVisual)
            .toHaveBeenCalledWith(TEST_BINDER_ID, TEST_IMG_ID, { status: VisualStatus.PROCESSING });
        expect(binderVisualRepository.updateVisual)
            .toHaveBeenCalledWith(TEST_BINDER_ID, TEST_IMG_ID, { status: VisualStatus.ERROR });
    });

    it("processes new image succeeds at resizing step", async () => {
        binderVisualRepository.updateVisual
            .calledWith(any(), any(), any())
            .mockResolvedValue(TEST_IMAGE);
        const resizedFormats: Format[] = [{
            name: "MEDIUM",
            url: "url",
            width: 100,
            height: 100,
            size: 100,
        }];
        resizeImage.mockResolvedValueOnce(resizedFormats);
        binderVisualRepository.getAllVisualsByOriginalVisualData
            .calledWith(any(), any())
            .mockResolvedValueOnce([]);

        await imageService.doImageProcessing(TEST_IMAGE);

        expect(binderVisualRepository.updateVisual).toHaveBeenCalledTimes(2);
        expect(binderVisualRepository.updateVisual)
            .toHaveBeenCalledWith(TEST_BINDER_ID, TEST_IMG_ID, { status: VisualStatus.PROCESSING });
        const imageFormat = new ImageFormat(ImageFormatType.MEDIUM, 100, 100, 100, "url", undefined, logger);
        expect(binderVisualRepository.updateVisual)
            .toHaveBeenCalledWith(TEST_BINDER_ID, TEST_IMG_ID, { extraFormats: [imageFormat], status: VisualStatus.COMPLETED, streamingInfo: undefined });
    });
});