import * as HTTPStatusCode from "http-status-codes";
import { EntityNotFound } from "@binders/client/lib/clients/model";
import type { ErrorRequestHandler } from "express";
import type { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

const notificationErrorHandler: ErrorRequestHandler = (err, req: WebRequest, res, next) => {
    if (req.logger) {
        const errorMessage = err.message || ("toString" in err) ? err.toString() : err;
        req.logger.error(errorMessage, "notification-service", err);
    }
    if (err.errorName === EntityNotFound.errorName) {
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({ error: err.message }));
        return;
    }
    const response = JSON.stringify({ error: "Something went wrong", details: err.validationErrors });
    finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
    next(err);
}

export default notificationErrorHandler;