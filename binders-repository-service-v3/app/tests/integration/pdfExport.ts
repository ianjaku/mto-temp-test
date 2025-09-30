import {
    Format,
    IVisualFormatSpec,
    ImageServiceContract,
    Visual,
    VisualKind,
    VisualStatus,
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { IThumbnail, Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { MockProxy, mock } from "jest-mock-extended";
import {
    buildPublicationHTMLParts,
    getPublicationVisualsForPdfExport
} from "@binders/binders-v3/src/exportservice/pdf";
import { JSDOM } from "jsdom";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

describe("PDF export", () => {
    describe("buildPublicationHTMLParts", () => {
        it("should use default medium thumbnail if no ancestor visual is found", async () => {
            const logger: MockProxy<Logger> = mock();

            const BINDER_ID = "MOCK_BINDER_ID";
            const THUMBNAIL_MEDIUM_IMAGE_ID = "img-00000000-0000-0000-0000-000000000000";
            const mockedPublication = mockPublication({
                binderId: BINDER_ID,
                thumbnailMediumImageId: THUMBNAIL_MEDIUM_IMAGE_ID,
                title: "Test Publication",
            });

            const pdfHtmlParts = await buildPublicationHTMLParts(
                mockedPublication,
                [],
                {},
                "Europe/Brussels",
                "test.manual.to",
                { cdnnify: true },
                logger,
                "img.manual.to",
                x => Promise.resolve(x),
                true,
                null,
                true,
            );

            expect(pdfHtmlParts).toHaveLength(1);
            const pdfHtml = pdfHtmlParts.at(0);
            expect(pdfHtml).toMatch("<h1>Test Publication</h1>");
            const dom = new JSDOM(pdfHtml);
            const doc = dom.window.document;
            const titleEl = doc.querySelector(".title-wrapper>h1");
            expect(titleEl).not.toBeNull();
            expect(titleEl.innerHTML).toEqual("Test Publication");
            const firstChunkVisual: HTMLDivElement = doc.querySelector("div.chunk>div.chunk-visual");
            expect(firstChunkVisual).not.toBeNull();
            expect(firstChunkVisual.style.backgroundImage).toBe(`url(${mockedPublication.thumbnail.medium})`);
        });

        it("should use original thumbnail of ancestor if found", async () => {
            const logger: MockProxy<Logger> = mock();

            const BINDER_ID = "MOCK_BINDER_ID_00000";
            const COLLECTION_ID = "MOCK_COLLECTION_ID_0";
            const THUMBNAIL_MEDIUM_IMAGE_ID = "img-00000000-0000-0000-0000-000000000000";
            const mockedPublication = mockPublication({
                binderId: BINDER_ID,
                thumbnail: {
                    ancestorCollectionId: COLLECTION_ID,
                    bgColor: "ffffff",
                    fitBehaviour: "fit",
                    medium: mockImageUrl({ binderId: COLLECTION_ID, imageId: THUMBNAIL_MEDIUM_IMAGE_ID, format: "MEDIUM" }),
                    thumbnail: mockImageUrl({ binderId: COLLECTION_ID, imageId: THUMBNAIL_MEDIUM_IMAGE_ID, format: "THUMBNAIL" }),
                },
                title: "Test Publication",
            });

            const pdfHtmlParts = await buildPublicationHTMLParts(
                mockedPublication,
                [
                    mockImageVisual({
                        id: THUMBNAIL_MEDIUM_IMAGE_ID,
                        binderId: COLLECTION_ID,
                        formats: [{
                            height: 1,
                            name: "ORIGINAL",
                            size: 1,
                            url: mockImageUrl({ binderId: COLLECTION_ID, imageId: THUMBNAIL_MEDIUM_IMAGE_ID, format: "ORIGINAL" }),
                            width: 1,
                        }],
                        formatUrls: [{
                            height: 1,
                            isVideo: false,
                            url: mockImageUrl({ binderId: COLLECTION_ID, imageId: THUMBNAIL_MEDIUM_IMAGE_ID, format: "ORIGINAL" }),
                            width: 1,
                        }],
                        urlToken: "URL_TOKEN",
                    }),
                ],
                {},
                "Europe/Brussels",
                "test.manual.to",
                { cdnnify: true },
                logger,
                "img.manual.to",
                x => Promise.resolve(x),
                true,
                null,
                true,
            );

            expect(pdfHtmlParts).toHaveLength(1);
            const pdfHtml = pdfHtmlParts.at(0);
            expect(pdfHtml).toMatch("<h1>Test Publication</h1>");
            const dom = new JSDOM(pdfHtml);
            const doc = dom.window.document;
            const titleEl = doc.querySelector(".title-wrapper>h1");
            expect(titleEl).not.toBeNull();
            expect(titleEl.innerHTML).toEqual("Test Publication");
            const firstChunkVisual: HTMLDivElement = doc.querySelector("div.chunk>div.chunk-visual");
            expect(firstChunkVisual).not.toBeNull();
            const expectedImageUrl = mockImageUrl({ binderId: COLLECTION_ID, imageId: THUMBNAIL_MEDIUM_IMAGE_ID, format: "ORIGINAL" })
            expect(firstChunkVisual.style.backgroundImage).toBe(`url(${expectedImageUrl})`);
        });
    });

    describe("getPublicationVisualsForPdfExport", () => {
        it("should return no visuals when thumbnail doesn't have ancestorCollectionId", async () => {
            const BINDER_ID = "MOCK_BINDER_ID";
            const THUMBNAIL_MEDIUM_IMAGE_ID = "img-00000000-0000-0000-0000-000000000000";
            const imageServiceContract: MockProxy<ImageServiceContract> = mock();
            const logger: MockProxy<Logger> = mock();

            const mockedPublication = mockPublication({
                binderId: BINDER_ID,
                thumbnailMediumImageId: THUMBNAIL_MEDIUM_IMAGE_ID,
            });

            imageServiceContract.listVisuals
                .calledWith(BINDER_ID)
                .mockResolvedValueOnce([]);

            const actual = await getPublicationVisualsForPdfExport(
                mockedPublication,
                imageServiceContract,
                logger,
                { cdnnify: true },
            );

            expect(actual).toEqual([]);
        });

        it("should return inherited thumbnail thumbnail has ancestorCollectionId", async () => {
            const BINDER_ID = "MOCK_BINDER_ID_00000";
            const COLLECTION_ID = "MOCK_COLLECTION_ID_0";
            const THUMBNAIL_MEDIUM_IMAGE_ID = "img-00000000-0000-0000-0000-000000000000";

            const imageServiceContract: MockProxy<ImageServiceContract> = mock();
            const logger: MockProxy<Logger> = mock();

            const mockedPublication = mockPublication({
                binderId: BINDER_ID,
                thumbnail: {
                    fitBehaviour: "fit",
                    bgColor: "ffffff",
                    medium: mockImageUrl({
                        binderId: BINDER_ID,
                        imageId: THUMBNAIL_MEDIUM_IMAGE_ID,
                        format: "MEDIUM",
                    }),
                    ancestorCollectionId: COLLECTION_ID,
                    thumbnail: mockImageUrl({
                        binderId: BINDER_ID,
                        imageId: THUMBNAIL_MEDIUM_IMAGE_ID,
                        format: "THUMBNAIL",
                    }),
                },
            });
            const mockedImage = mockImageVisual({
                id: THUMBNAIL_MEDIUM_IMAGE_ID,
                binderId: BINDER_ID,
            });

            imageServiceContract.listVisuals
                .calledWith(BINDER_ID)
                .mockResolvedValueOnce([]);
            imageServiceContract.getVisual
                .calledWith(COLLECTION_ID, THUMBNAIL_MEDIUM_IMAGE_ID)
                .mockResolvedValue(mockedImage);

            const actual = await getPublicationVisualsForPdfExport(
                mockedPublication,
                imageServiceContract,
                logger,
                { cdnnify: true },
            );

            expect(actual).toEqual([mockedImage]);
        });
    });
});

function mockPublication(values: {
    binderId?: string;
    thumbnailMediumImageId?: string;
    thumbnail?: IThumbnail;
    title?: string;
}): Publication {
    return {
        accountId: "MOCK_ACCOUNT_ID",
        authorIds: [],
        binderId: values.binderId ?? "MOCK_BINDER_ID",
        bindersVersion: "1",
        isActive: true,
        language: {
            iso639_1: "xx",
            storyTitle: values.title ?? "Mock Binder",
            storyTitleRaw: values.title ?? "Mock Binder",
            modules: ["t1"],
        },
        links: { indexPairs: [] },
        modules: {
            images: {
                chunked: [
                    { key: "i1", chunks: [] },
                ],
            },
            text: {
                chunked: [
                    { key: "t1", iso639_1: "xx", editorStates: [], chunks: [] },
                ],
            },
        },
        publicationDate: new Date(),
        thumbnail: values.thumbnail ?? {
            fitBehaviour: "fit",
            bgColor: "ffffff",
            medium: `https://example.invalid/${values.thumbnailMediumImageId ?? "img-00000000-0000-0000-0000-000000000000"}/medium`,
        },
    }
}

function mockImageVisual(values: {
    id?: string;
    binderId?: string;
    formats?: Format[];
    formatUrls?: IVisualFormatSpec[];
    urlToken?: string;
    urls?: Record<string, unknown>;
}): Visual {
    return {
        id: values.id ?? "img-00000000-0000-0000-0000-000000000000",
        bgColor: "",
        binderId: values.binderId ?? "MOCK_BINDER_ID",
        created: "",
        extension: "",
        filename: "",
        fitBehaviour: "fit",
        formats: values.formats ?? [],
        formatUrls: values.formatUrls,
        kind: VisualKind.IMAGE,
        languageCodes: [],
        mime: "",
        status: VisualStatus.COMPLETED,
        urlToken: values.urlToken,
        urls: values.urls ?? {},
    }
}

function mockImageUrl(values: {
    binderId: string;
    format: "MEDIUM" | "ORIGINAL" | "THUMBNAIL";
    imageId: string;
}): string {
    return `https://binder-prod-images-cdn.azureedge.net/images-production/0000/0000/${values.binderId}/${values.imageId}/${values.format}`
}
