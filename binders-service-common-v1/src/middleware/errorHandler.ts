import * as HTTPStatusCode from "http-status-codes";
import { WebRequest, finishRequestTimings } from "./request";
import { ErrorRequestHandler } from "express";
import { logUncaughtError } from "../monitoring/apm";

export const defaultErrorHandler: ErrorRequestHandler = (err, req: WebRequest, res, next) => {

    logRequestAndError(req, err);
    logUncaughtError(err, req);
    finishRequestTimings(req);

    if (res.headersSent) {
        // 'send' was already invoked, there's nothing else to do
        // than invoke the express default error handler (per doc)
        return next(err);
    }
    if (err.name === "PayloadTooLargeError") {
        return res.status(HTTPStatusCode.REQUEST_TOO_LONG)
            .json({ error: "Payload too large." });
    }
    if (err.name === "SyntaxError") {
        return res.status(HTTPStatusCode.BAD_REQUEST)
            .json({ error: "Invalid payload." });
    }
    return res.status(HTTPStatusCode.INTERNAL_SERVER_ERROR)
        .json({ error: "An unknown error occurred" });
}

const logRequestAndError = (req: WebRequest, err: unknown) => {
    if (req.logger) {
        const data = err instanceof Error ?
            {
                message: err.message,
                url: req.url,
                method: req.method,
                stack: err.stack
            } :
            err;
        req.logger.fatal("Unhandled error.", "request", data);
    } else {
        // eslint-disable-next-line no-console
        console.error(err);
        // eslint-disable-next-line no-console
        console.error(req);
    }
}
