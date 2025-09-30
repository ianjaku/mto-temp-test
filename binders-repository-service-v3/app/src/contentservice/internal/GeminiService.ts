import { FileState, GoogleGenAI, Type, createPartFromUri, createUserContent } from "@google/genai";
import { ILlmVideoService, LlmFile, ManualConfig } from "./llm";
import { Config } from "@binders/client/lib/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { backOff } from "exponential-backoff";
import { readFile } from "fs/promises";

type GeminiConfig = {
    apiKey: string;
}

/** This error is thrown while the file is not ready yet (still processing by Gemini) */
class FileNotReadyError extends Error { }

/** This error is thrown when the file state is not retryable due to some Gemini side error */
class NonRetryableFileStateError extends Error { }

async function filePathToBlob(filePath: string, mimeType = "application/octet-stream"): Promise<Blob> {
    const buffer = await readFile(filePath);
    return new Blob([buffer], { type: mimeType });
}

export class GeminiService implements ILlmVideoService {
    private client: GoogleGenAI;

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    async uploadFile(filePath: string, logger: Logger): Promise<LlmFile> {
        const llmFile = await this.client.files.upload({
            file: await filePathToBlob(filePath),
            config: { mimeType: "video/mp4" }
        });
        if (!llmFile.uri || !llmFile.mimeType) {
            throw new Error("Invalid file upload - missing uri or mimeType");
        }

        try {
            await backOff(async () => {
                const fileInformation = await this.client.files.get({ name: llmFile.name });
                if (fileInformation?.state === FileState.FAILED) {
                    throw new NonRetryableFileStateError(`File ${fileInformation.name} processing FAILED.`);
                } else if (fileInformation?.state !== FileState.ACTIVE) {
                    throw new FileNotReadyError(`File ${fileInformation?.name ?? "n/a"} is not ready yet. Current state: ${fileInformation?.state ?? "unknown"}`);
                }
                return fileInformation;
            }, {
                delayFirstAttempt: true,
                startingDelay: 500,
                maxDelay: 3000,
                numOfAttempts: 100,
                timeMultiple: 1.5,
                retry: (error, _) => {
                    if (error instanceof NonRetryableFileStateError) {
                        logger.error(error.message, "gemini-service");
                        return false;
                    } else if (error instanceof FileNotReadyError) {
                        logger.info(error.message, "gemini-service");
                    } else {
                        logger.warn("Failed to get file status", "gemini-service", error);
                    }
                    // Due to the instability of the Gemini service, we won't make the distinction between
                    // the file not being ready and other API errors. As long as the file is not ready or
                    // failed, we will attempt up to 100 retries.
                    return true;
                },
            });
        } catch (e) {
            throw new Error("Failed to resolve the uploaded file status", { cause: e });
        }
        return {
            fileId: llmFile.name,
            mimeType: llmFile.mimeType,
            name: llmFile.name,
            sizeBytes: llmFile.sizeBytes,
            uri: llmFile.uri,
        }
    }

    async generateManualFromVideo(
        llmFile: LlmFile,
        description: string | undefined,
        logger: Logger,
    ): Promise<{ instructions: ManualConfig; usage: Record<string, unknown> }> {
        const prompt = `
Split the video into a step-by-step guide and for every step write a short text explaining what the user should do in an imperative style.
Also include the exact timestamps when the step starts and ends.

Separately in the "thumbnailTimestamp" field include the timestamp (a decimal number in seconds) of the frame that best represents the step-by-step guide.
This will be used as a thumbnail together with the title to show what the guide is about.

The video for every step should be at least 1 second, and at most 20 seconds long.

${description?.length ? `Additional context: ${description}` : ""}

Respond in the following JSON format:
{
  title: string,
  thumbnailTimestamp: number,
  steps: {
    videoStartTimestampMs: string,
    videoEndTimestampMs: string,
    text: string,
  }[]
}

The timestamps should always be returned in the MM:SS.S format (meaning minutes and seconds to the precision of 1/10th of a second).
    `.trim();

        try {
            return await backOff(async () => {
                const response = await this.client.models.generateContent({
                    model: "gemini-2.5-flash",
                    config: {
                        responseMimeType: "application/json",
                        responseJsonSchema: {
                            type: Type.OBJECT,
                            properties: {
                                title: {
                                    type: Type.STRING,
                                    description: "The title of the step-by-step guide",
                                },
                                thumbnailTimestamp: {
                                    type: Type.NUMBER,
                                    description: "The timestamp of the frame that best represents the step-by-step guide",
                                },
                                steps: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            videoStartTimestampMs: {
                                                type: Type.STRING,
                                                description: "The timestamp in the MM:SS.S format of the first frame",
                                            },
                                            videoEndTimestampMs: {
                                                type: Type.STRING,
                                                description: "The timestamp in the MM:SS.S format of the last frame",
                                            },
                                            text: {
                                                type: Type.STRING,
                                                description: "The text explaining what the user should do in an imperative style",
                                            }
                                        },
                                        required: ["videoStartTimestampMs", "videoEndTimestampMs", "text"],
                                    }
                                }
                            },
                            required: ["title", "steps"],
                            additionalProperties: false,
                        }
                    },
                    contents: createUserContent([
                        createPartFromUri(llmFile.uri, llmFile.mimeType),
                        prompt,
                    ]),
                });
                if (!response.text) {
                    throw new Error("No response text received from Gemini");
                }

                let manualConfig;
                try {
                    manualConfig = JSON.parse(response.text);
                } catch (err) {
                    logger.error("Could not parse response json", "gemini-service", response);
                    throw err;
                }
                for (const step of manualConfig.steps) {
                    if (!step.videoStartTimestampMs || !step.videoEndTimestampMs) {
                        logger.error(`Step ${JSON.stringify(step)} does not contain timestamps`, "gemini-service", manualConfig);
                        throw new Error("Step does not contain timestamps")
                    }
                    step.videoStartTimestampMs = convertTimestampToSeconds(step.videoStartTimestampMs);
                    step.videoEndTimestampMs = convertTimestampToSeconds(step.videoEndTimestampMs);
                }
                return { instructions: manualConfig, usage: { ...response.usageMetadata } };
            }, {
                delayFirstAttempt: true,
                startingDelay: 500,
                maxDelay: 3000,
                numOfAttempts: 3,
                timeMultiple: 1.0,
                retry: (error, retryNo) => {
                    logger.error(`Failed to generate manual with error '${error.message}'. Retry ${retryNo}`, "gemini-service");
                    return true;
                },
            });
        } catch (e) {
            logger.error("Failed to generate manual", "gemini-service", e);
            throw new Error("Failed to generate manual", { cause: e });
        }
    }

    static fromConfig(config: Config): GeminiService {
        const maybeGeminiConfig = config.getObject<GeminiConfig>("gemini");
        if (maybeGeminiConfig.isNothing()) {
            throw new Error("Missing Gemini config");
        }
        const geminiConfig = maybeGeminiConfig.get();
        return new GeminiService(geminiConfig.apiKey);
    }
}

const convertTimestampToSeconds = (timestamp: string): number => {
    const [minutes, secondsAndMs] = timestamp.split(":");
    const [seconds, milliseconds] = secondsAndMs.split(".");
    return (minutes ? Number(minutes) : 0) * 60 * 1000 +
        (seconds ? Number(seconds) : 0) * 1000 +
        (milliseconds ? Number(milliseconds) : 0);
}
