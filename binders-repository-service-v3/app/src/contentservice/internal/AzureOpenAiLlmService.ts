/* eslint-disable no-console */
import { AzureKeyCredential, ChatCompletions, OpenAIClient } from "@azure/openai";
import type { ILlmService, Identity } from "./llm";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ServerEvent, captureServerEvent } from "@binders/binders-service-common/lib/tracking/capture";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Config } from "@binders/client/lib/config/config";
import { ContentServiceError } from "./errors";
import { ContentServiceErrorCode } from "@binders/client/lib/clients/contentservice/v1/contract";
import { PROMPT_SYSTEM } from "./prompts";
import { humanizeDuration } from "@binders/client/lib/util/formatting";
import { inspect } from "util";

type AzureOpenAiConfig = {
    apiKey: string;
    endpoint: string;
}

export type OpenAiErrorData = {
    code: string;
    innererror?: {
        code: string;
        content_filter_result: {
            [key: string]: { filtered: boolean; severity: "safe" | "medium" }
        };
    };
    message: string;
    param?: string;
    status: number;
}

export class OpenAiError extends Error {
    constructor(readonly data: OpenAiErrorData) {
        super(`OpenAI Error (${data.code}): ${data.message}`)
    }
}

export class AzureOpenAiLlmService implements ILlmService {
    private client: OpenAIClient;
    private logger: Logger;

    constructor(endpoint: string, azureApiKey: string) {
        this.client = new OpenAIClient(
            endpoint,
            new AzureKeyCredential(azureApiKey),
        );
        this.logger = LoggerBuilder.fromConfig(BindersConfig.get());
    }

    static fromConfig(config: Config): AzureOpenAiLlmService {
        const maybeOpenAiConfig = config.getObject("azure.openAi");
        if (maybeOpenAiConfig.isNothing()) {
            throw new Error("Missing Open AI config")
        }
        const openAiConfig = maybeOpenAiConfig.get() as AzureOpenAiConfig;
        return new AzureOpenAiLlmService(openAiConfig.endpoint, openAiConfig.apiKey);
    }

    async optimizeContent(
        text: string,
        options: {
            choicesCount?: number;
            logNoChoicesError?: boolean;
        },
        identity: Identity,
        context: Record<string, unknown>,
    ): Promise<string[]> {
        try {
            const startedAt = Date.now();
            const MODEL_DEPLOYMENT_NAME = "gpt-4o";
            const result = await this.client.getChatCompletions(
                MODEL_DEPLOYMENT_NAME,
                [
                    { role: "system", content: PROMPT_SYSTEM },
                    { role: "user", content: text },
                ],
                { n: options?.choicesCount ?? 1 },
            );
            this.#logUsage(context, identity, text, result, startedAt);
            if (result.choices.length === 0) {
                throw new ContentServiceError(
                    ContentServiceErrorCode.NoChoices,
                    "No choices received from LLM engine",
                );
            }
            const validChoices = result.choices
                .filter(choice => choice.finishReason === "stop" && choice.message?.content)
                .map(choice => choice.message?.content);
            if (!validChoices.length) {
                const finishReasons = result.choices.map(c => c.finishReason)
                const contentFilterResults = result.choices.map(c => c.contentFilterResults)
                this.logger.error(
                    "OpenAI response did not return any valid choices.",
                    "open-ai",
                    { finishReasons, contentFilterResults },
                );
                if (finishReasons.includes("length")) {
                    throw new ContentServiceError(
                        ContentServiceErrorCode.ContentTooLarge,
                        `Content is too large: ${text.length}`,
                    )
                }
                if (finishReasons.includes("content_filter")) {
                    throw new ContentServiceError(
                        ContentServiceErrorCode.ContentFilter,
                        "Content filter triggered",
                    )
                }
                if (options?.logNoChoicesError) {
                    this.logger.error("No valid choices", "open-ai", result);
                }
                throw new ContentServiceError(
                    ContentServiceErrorCode.NoChoices,
                    "No valid choices",
                );
            }
            return validChoices;
        } catch (e) {
            if (e instanceof ContentServiceError) {
                throw e
            }
            const error = isOpenAIError(e) ?
                new OpenAiError(e) :
                new OpenAiError({
                    status: 500,
                    code: "unknown_error",
                    message: inspect(e),
                });
            throw error;
        }
    }

    #logUsage(
        context: Record<string, unknown>,
        identity: Identity,
        text: string,
        result: ChatCompletions,
        startedAt: number,
    ): void {
        const finishReasons = result.choices.map(c => c.finishReason);
        const llmOutputLength = result.choices.length > 0 ?
            result.choices
                .map(c => c.message?.content.length ?? 0)
                .reduce((a, b) => a + b) :
            0;
        const durationMs = Date.now() - startedAt;
        const usage = {
            ...context,
            completionTokens: result.usage.completionTokens,
            durationMs,
            finishReasons,
            promptTokens: result.usage.promptTokens,
            textLength: text.length,
            totalTokens: result.usage.totalTokens,
            llmChoices: result.choices.length,
            llmOutputLength,
        }
        captureServerEvent(ServerEvent.ContentV1AzureOpenAiUsageIncreased, identity, usage);
        this.logger.trace(
            `Usage report for Azure OpenAI on text with length ${text.length}, took ${humanizeDuration(durationMs)}, used total ${result.usage.totalTokens} tokens`,
            "usage-azure-open-ai",
            usage,
        );
    }
}

export function isOpenAIError(e: unknown): e is OpenAiErrorData {
    if (!(typeof e === "object" && e !== null)) {
        return false;
    }
    const err = e as OpenAiErrorData;
    return err.message?.length > 0 && err.code?.length > 0 && err.status > 0;
}
