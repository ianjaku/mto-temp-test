import { ErrorRequestHandler } from "express";
import { ResourceNotFound } from "@binders/client/lib/clients/model";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

const trackingErrorHandler: ErrorRequestHandler = (err, req: WebRequest, res, next): void => {
    if (err instanceof ResourceNotFound) {
        req?.logger?.error(`Could not find resource path ${req.url}`, "tracking-error");
        finishRequest(req, res, 404, JSON.stringify({ error: { message: err.message } }));
        return;
    }
    next(err);
}
export default trackingErrorHandler;
