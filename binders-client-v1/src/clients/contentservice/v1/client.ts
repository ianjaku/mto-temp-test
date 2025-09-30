import { BindersServiceClient, RequestHandler } from "../../client";
import type {
    ContentServiceContract,
    GenerateManualRequest,
    OptimizeBinderContentRequest,
    OptimizeBinderContentResponse,
    OptimizeChunkContentRequest,
    OptimizeChunkContentResponse,
} from "./contract";
import { Binder } from "../../repositoryservice/v3/contract";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config/config";
import { UploadableFile } from "../../imageservice/v1/contract";
import getRoutes from "./routes";

export class ContentServiceClient extends BindersServiceClient implements ContentServiceContract {
    constructor(endpointPrefix: string, requestHandler: RequestHandler) {
        super(endpointPrefix, getRoutes(), requestHandler);
    }

    static fromConfig(
        config: Config,
        requestHandler: RequestHandler
    ): ContentServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "content", "v1");
        return new ContentServiceClient(
            versionedPath,
            requestHandler,
        );
    }

    fileUpload(accountId: string, attachments: UploadableFile[]): Promise<{ fileId: string }> {
        return this.handleUpload("fileUpload", { pathParams: { accountId } }, { file: attachments });
    }

    forwardFileUpload(accountId: string, requestStream: unknown, requestHeaders: Record<string, string>): Promise<{ fileId: string }> {
        return this.handleForwardedUpload("forwardFileUpload", { pathParams: { accountId } }, requestStream, requestHeaders);
    }

    generateManual(req: GenerateManualRequest): Promise<Binder> {
        return this.handleRequest("generateManual", { body: req });
    }

    optimizeChunkContent(req: OptimizeChunkContentRequest): Promise<OptimizeChunkContentResponse> {
        return this.handleRequest("optimizeChunkContent", { body: req });
    }

    optimizeBinderContent(req: OptimizeBinderContentRequest): Promise<OptimizeBinderContentResponse> {
        return this.handleRequest("optimizeBinderContent", { body: req });
    }

    updateVisualTrimSettings(
        accountId: string,
        binderId: string,
        visualIdx: number,
        chunkIdx: number,
        startTimeMs: number,
        endTimeMs: number,
    ): Promise<Binder> {
        const options = {
            pathParams: {
                binderId,
            },
            body: {
                accountId,
                chunkIdx,
                endTimeMs,
                startTimeMs,
                visualIdx,
            }
        }
        return this.handleRequest("updateVisualTrimSettings", options);
    }
}
