import { Logger } from "@binders/binders-service-common/lib/util/logging";

export type Identity = {
    accountId: string;
    userId: string;
}

export type LlmFile = {
    fileId: string;
    name: string;
    uri: string;
    mimeType: string;
    sizeBytes: string;
}

export type Step = {
    videoStartTimestampMs: number;
    videoEndTimestampMs: number;
    text: string;
}

export type ManualConfig = {
    title: string;
    thumbnailTimestamp?: number;
    steps: Step[];
}


/**
 * Base interface for any LLM service supporting
 * - text-to-text conversion
*/
export interface ILlmService {
    /**
     * Optimize the given content to match manual.to guidelines.
    */
    optimizeContent(
        content: string,
        options: {
            choicesCount?: number;
            logNoChoicesError?: boolean;
        },
        identity: Identity,
        context: Record<string, unknown>,
    ): Promise<string[]>;
}

export interface ILlmVideoService {
    /**
     * Uploads a file and returns metadata about the uploaded file.
     *
     * @param filePath - Path to the file to be uploaded.
     * @param logger - request logger
     * @returns A promise resolving to an LlmFile object representing the uploaded file.
     */
    uploadFile(filePath: string, logger: Logger): Promise<LlmFile>;
    /**
     * Generates a structured manual configuration from a given video file.
     *
     * @param file - Metadata object representing the input video.
     * @param description - Optional description providing context for the manual generation.
     * @param logger - request logger
     * @returns A promise resolving to a ManualConfig object.
     */
    generateManualFromVideo(
        file: LlmFile,
        description: string | undefined,
        logger: Logger,
    ): Promise<{ instructions: ManualConfig; usage: Record<string, unknown> }>;
}
