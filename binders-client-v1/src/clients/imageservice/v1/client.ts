import { BindersServiceClient, RequestHandler } from "../../client";
import {
    DuplicatedVisual,
    IVideoIndexerResult,
    IVideoIndexerResultFilter,
    IVisualFormatUrlMap,
    IVisualSearchOptions,
    Image,
    ImageRotation,
    ImageServiceContract,
    UploadVisualOptions,
    UploadableFile,
    VideoDuration,
    Visual,
    VisualFitBehaviour
} from "./contract";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import { Logo } from "../../routingservice/v1/contract";
import { Visual as VisualObj } from "./Visual";
import getRoutes from "./routes";

export class ImageServiceClient extends BindersServiceClient implements ImageServiceContract {

    constructor(
        endpointPrefix: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ) {
        super(endpointPrefix, getRoutes(), requestHandler, accountIdProvider);
    }

    static fromConfig(
        config: Config,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ): ImageServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "image", "v1");
        return new ImageServiceClient(versionedPath, requestHandler, accountIdProvider);
    }

    addLogo(accountId: string, logoFile: File): Promise<Logo> {
        const options = { pathParams: { accountId } };
        return this.handleUpload<Logo>("addLogo", options, { logo: [logoFile] });
    }

    async listVisuals(binderId: string, options?: IVisualSearchOptions): Promise<Array<Visual>> {
        const reqOptions = {
            pathParams: {
                binderId,
                ...(options ? { options: JSON.stringify(options) } : {}),
            }
        };
        const visuals = await this.handleRequest<Visual[]>("listVisuals", reqOptions);
        return visuals.map(visual => Object.assign(Object.create(VisualObj.prototype), visual));
    }

    async getFeedbackAttachmentVisuals(binderId: string, options?: IVisualSearchOptions): Promise<Visual[]> {
        const reqOptions = {
            body: {
                binderId,
                ...(options ? { options: JSON.stringify(options) } : {}),
            }
        };
        const visuals = await this.handleRequest<Visual[]>("getFeedbackAttachmentVisuals", reqOptions);
        return visuals.map(visual => Object.assign(Object.create(VisualObj.prototype), visual));
    }

    async getVisual(binderId: string, visualId: string, options?: IVisualSearchOptions): Promise<Visual> {
        const reqOptions = {
            pathParams: {
                binderId,
                visualId,
                ...(options ? { options: JSON.stringify(options) } : {}),
            }
        };
        const visual = await this.handleRequest("getVisual", reqOptions);
        return Object.assign(Object.create(VisualObj.prototype), visual);
    }

    getVisualByOriginalVisualData(originalBinderId: string, originalVisualId: string, binderId: string): Promise<Visual> {
        const options = {
            pathParams: {
                originalBinderId,
                originalVisualId,
                binderId,
            }
        };
        return this.handleRequest("getVisualByOriginalVisualData", options);
    }


    duplicateVisuals(binderId: string, targetId: string): Promise<Array<DuplicatedVisual>> {
        const options = {
            pathParams: {
                binderId,
                targetId
            }
        };
        return this.handleRequest<Array<DuplicatedVisual>>("duplicateVisuals", options);
    }

    uploadVisual(
        binderId: string,
        attachments: UploadableFile[],
        accountId: string,
        onProgress?: (visualId: string, percent: number) => void,
        onEnd?: () => void,
        options?: UploadVisualOptions,
    ): Promise<Array<string>> {
        const reqOptions = {
            pathParams: {
                binderId,
                accountId,
            },
            queryParams: {
                ...(options ?
                    {
                        options: encodeURIComponent(JSON.stringify(options)), // note: we cannot easily use body here, because the uploading file is the body
                    } :
                    {}),
            }
        };
        return this.handleUpload<string[]>("uploadVisual", reqOptions, { image: attachments }, onProgress, onEnd);
    }

    deleteImage(binderId: string, imageId: string): Promise<void> {
        const options = {
            pathParams: {
                binderId,
                imageId
            }
        };
        return this.handleRequest<void>("deleteImage", options);
    }

    deleteVisuals(binderId: string, visualIds: string[]): Promise<void> {
        const options = {
            body: {
                binderId,
                visualIds
            }
        };
        return this.handleRequest<void>("deleteVisuals", options);
    }

    hardDeleteVisual(binderId: string, visualId: string): Promise<void> {
        const options = {
            pathParams: {
                binderId,
                visualId,
            }
        };
        return this.handleRequest<void>("hardDeleteVisual", options);
    }

    hardDeleteVisuals(filter: { binderIds: string[] }): Promise<void> {
        const options = {
            body: {
                filter,
            }
        };
        return this.handleRequest<void>("hardDeleteVisuals", options);
    }

    updateVisualFitBehaviour(binderId: string, visualId: string, newFitBehaviour: VisualFitBehaviour): Promise<Visual> {
        const options = {
            pathParams: {
                binderId,
                visualId,
                fitBehaviour: newFitBehaviour
            }
        };
        return this.handleRequest("updateVisualFitBehaviour", options);
    }

    updateVisualRotation(binderId: string, visualId: string, rotation: ImageRotation): Promise<Visual> {
        const options = {
            pathParams: {
                binderId,
                visualId,
                rotation,
            }
        };
        return this.handleRequest("updateVisualRotation", options);
    }

    updateImageBgColor(binderId: string, imageId: string, newBgColor: string): Promise<Image> {
        return this.updateVisualBgColor(binderId, imageId, newBgColor);
    }

    updateVisualBgColor(binderId: string, visualId: string, newBgColor: string): Promise<Visual> {
        const options = {
            pathParams: {
                binderId,
                visualId,
                bgColor: newBgColor
            }
        };
        return this.handleRequest("updateVisualBgColor", options);
    }

    updateVisualLanguageCodes(binderId: string, visualId: string, languageCodes: string[]): Promise<Visual> {
        const options = {
            pathParams: {
                binderId,
                visualId
            },
            body: {
                languageCodes
            }
        };
        return this.handleRequest("updateVisualLanguageCodes", options);
    }

    updateVisualAudio(binderId: string, visualId: string, enabled: boolean): Promise<Visual> {
        const options = {
            pathParams: {
                binderId,
                visualId
            },
            body: {
                enabled
            }
        };
        return this.handleRequest("updateVisualAudio", options);
    }

    updateVisualAutoPlay(binderId: string, visualId: string, autoPlay: boolean): Promise<Visual> {
        const options = {
            pathParams: {
                binderId,
                visualId
            },
            body: {
                autoPlay
            }
        }
        return this.handleRequest("updateVisualAutoPlay", options);
    }

    restartVideoProcessing(visualId: string): Promise<void> {
        const options = {
            body: { visualId }
        };
        return this.handleRequest("restartVideoProcessing", options);
    }

    queryVideoDurations(videoIds: string[]): Promise<VideoDuration> {
        const options = {
            body: {
                videoIds
            }
        };
        return this.handleRequest("queryVideoDurations", options);
    }

    composeVisualFormatUrls(visualIds: string[], options: IVisualSearchOptions): Promise<IVisualFormatUrlMap> {
        const optionsObj = {
            body: {
                visualIds,
                options
            }
        };
        return this.handleRequest("composeVisualFormatUrls", optionsObj);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    videoIndexerCallback(_id: string, _state: string): Promise<void> {
        throw new Error("not callable with client");
    }

    createVideoSasTokens(
        videoIds: string[],
        accountId?: string // Used in integration tests, because the accountId is not automatically provided there
    ): Promise<Record<string, string>> {
        return this.handleRequest("createVideoSasTokens", { body: { videoIds }, queryParams: { accountId } });
    }

    findVideoIndexerResults(filter: IVideoIndexerResultFilter): Promise<IVideoIndexerResult[]> {
        const options = {
            pathParams: {
                filter: JSON.stringify(filter)
            }
        };
        return this.handleRequest("findVideoIndexerResults", options);
    }

    indexVideo(visualId: string, accountId: string): Promise<void> {
        const options = {
            body: {
                visualId,
                accountId,
            }
        };
        return this.handleRequest("indexVideo", options);
    }

    getVisualIdByImageUrl(url: string): Promise<string> {
        const options = {
            body: {
                url
            }
        };
        return this.handleRequest("getVisualIdByImageUrl", options);
    }

    ensureScreenshotAt(binderId: string, visualId: string, timestampMs: number, accountId: string): Promise<void> {
        const options = {
            body: { binderId, visualId, timestampMs, accountId },
        };
        return this.handleRequest("ensureScreenshotAt", options);
    }

}
