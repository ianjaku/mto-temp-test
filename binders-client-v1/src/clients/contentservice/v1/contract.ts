import type { Binder } from "../../repositoryservice/v3/contract"
import type { UploadableFile } from "../../imageservice/v1/contract"

export interface ContentServiceContract {
    fileUpload(accountId: string, attachments: UploadableFile[]): Promise<{ fileId: string }>;
    forwardFileUpload(accountId: string, requestStream: unknown, requestHeaders: Record<string, string>): Promise<{ fileId: string }>;
    generateManual(req: GenerateManualRequest): Promise<Binder>;
    /** Optimizes content of a chunk */
    optimizeChunkContent(req: OptimizeChunkContentRequest): Promise<OptimizeChunkContentResponse>
    /** Optimizes content of a Binder */
    optimizeBinderContent(req: OptimizeBinderContentRequest): Promise<OptimizeBinderContentResponse>
    updateVisualTrimSettings(accountId: string, binderId: string, visualId: number, chunkIdx: number, startTimeMs: number, endTimeMs: number): Promise<Binder>;
}

export type GenerateManualRequest = {
    accountId: string;
    /** Target collection to save the generated manual */
    collectionId: string;
    /** Optional context added to the prompt */
    context?: string;
    /** List of file IDs to be used in generating the manual (e.g., videos or documents) */
    fileIds: string[];
    /** Optional title of the generated manual */
    title?: string;
    /** User requesting the manual generation */
    userId: string;
}

export type OptimizeChunkContentRequest = {
    accountId: string;
    binderId: string;
    /** Chunk index to be optimized. Title chunk is 0 */
    chunkIdx: number;
    /** Language index */
    langIdx: number;
    /** If set to true, updates & saves the {@link Binder} with the optimized chunk */
    save?: boolean;
}

export type OptimizeChunkContentResponse = {
    /**
    * Updated binder with the optimized chunk
    * undefined if {@link OptimizeChunkContentRequest#save} is false
    */
    binder?: Binder;
    /** Markdown of the optimized chunk */
    markdown: string;
}

export type OptimizeBinderContentRequest = {
    accountId: string;
    binderId: string;
    /** Language index */
    langIdx: number;
    /** If set to true, it will update & save the {@link Binder} with the optimized chunk */
    save?: boolean;
}

export type OptimizeBinderContentResponse = {
    /**
    * Updated binder with the optimized content
    * undefined if {@link OptimizeBinderContentRequest#save} is false
    */
    binder?: Binder;
}

export enum ContentServiceErrorCode {
    ContentFilter = "content_filter",
    ContentTooLarge = "content_too_large",
    EngineFail = "engine_fail",
    InvalidBinder = "invalid_binder",
    NoChoices = "no_choices",
}
