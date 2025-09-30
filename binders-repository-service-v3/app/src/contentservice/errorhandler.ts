import * as HTTPStatusCode from "http-status-codes";
import { ContentServiceError } from "./internal/errors";
import { ContentServiceErrorCode } from "@binders/client/lib/clients/contentservice/v1/contract";
import { ErrorRequestHandler } from "express";
import { OpenAiError } from "./internal/AzureOpenAiLlmService";
import { UnsupportedMedia } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

const contentErrorHandler: ErrorRequestHandler = (err, req: WebRequest, res, next) => {
    function failRequest(
        statusCode: number,
        csError: ContentServiceError,
    ) {
        if (err !== csError) {
            req.logger?.debug("Content service original error", "content-v1", err);
        }
        req.logger?.error(`Content service error. Status code: ${statusCode}`, "content-v1", csError);
        return finishRequest(req, res, statusCode, {
            error: {
                kind: "ContentServiceError",
                code: csError.code,
                message: csError.message,
            },
        });
    }

    if (err instanceof ContentServiceError) {
        return failRequest(
            HTTPStatusCode.INTERNAL_SERVER_ERROR,
            err,
        );
    }

    if (err instanceof OpenAiError) {
        if (err.data.code === "content_filter") {
            return failRequest(
                HTTPStatusCode.BAD_REQUEST,
                new ContentServiceError(
                    ContentServiceErrorCode.ContentFilter,
                    "Content filter triggered",
                ),
            );
        }
        return failRequest(
            HTTPStatusCode.INTERNAL_SERVER_ERROR,
            new ContentServiceError(
                ContentServiceErrorCode.EngineFail,
                `LLM engine failed with code ${err.data.code}`,
            ),
        );
    }

    if (err instanceof UnsupportedMedia) {
        req.logger?.error("Content service unsupported media error", "content-v1", err);
        return finishRequest(req, res, HTTPStatusCode.UNSUPPORTED_MEDIA_TYPE, JSON.stringify({
            name: UnsupportedMedia.NAME,
            translationKey: err["translationKey"],
            message: err.message,
        }));
    }

    next(err);
}

export default contentErrorHandler;
