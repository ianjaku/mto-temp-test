import * as HTTPStatusCode from "http-status-codes";
import { EntityNotFound } from "@binders/client/lib/clients/model";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

export class PlgError extends Error {
    public code: string;
    constructor(message: string, code: string) {
        super(message);
        this.code = code;
    }
}

export class PublicApiError extends Error {
    public code: string;
    constructor(message: string, code: string) {
        super(message);
        this.code = code;
    }
}

export class FileSizeExceededError extends Error {
    public code: string;
    public maxSizeBytes: number;
    public contentSizeBytes: string;
    constructor(message: string, maxSizeBytes: number, contentSizeBytes: string) {
        super(message);
        this.code = "FILE_TOO_LARGE";
        this.maxSizeBytes = maxSizeBytes;
        this.contentSizeBytes = contentSizeBytes;
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function publicApiErrorHandler(err, req: WebRequest, res, next) {
    req.logger?.logException(err, "public-api");
    if (err.statusCode) {
        const error = err.message;
        return finishRequest(req, res, err.statusCode, JSON.stringify({ error }))
    }
    if (err.name === EntityNotFound.errorName) {
        return finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({ error: err.message }));
    }
    if (err instanceof FileSizeExceededError) {
        return finishRequest(req, res, HTTPStatusCode.REQUEST_TOO_LONG, JSON.stringify({
            error: err.message,
            errorCode: err.code,
            maxSizeBytes: err.maxSizeBytes
        }));
    }
    if (err instanceof PublicApiError) {
        return finishRequest(req, res, HTTPStatusCode.INTERNAL_SERVER_ERROR, JSON.stringify({
            error: err.message,
            code: err.code,
            kind: "PublicApiError",
        }));
    }
    if (err instanceof PlgError) {
        return finishRequest(req, res, HTTPStatusCode.INTERNAL_SERVER_ERROR, JSON.stringify({
            error: err.message,
            code: err.code,
            kind: "PlgError",
        }));
    }
    next(err);
}
