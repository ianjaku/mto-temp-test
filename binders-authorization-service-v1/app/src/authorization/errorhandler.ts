import * as HTTPStatusCode from "http-status-codes";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function authorizationErrorHandler (err, req, res, next) {
    if (err.name === Unauthorized.NAME) {
        const message = "Access denied";
        res.writeHead(HTTPStatusCode.UNAUTHORIZED, message);
        res.end(message);
        return;
    }
    if (err.statusCode === 404) {
        return finishRequest(req, res, HTTPStatusCode.NOT_FOUND, "Item not found");
    }
    next(err);
}