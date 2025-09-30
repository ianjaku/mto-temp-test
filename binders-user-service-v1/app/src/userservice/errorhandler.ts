import * as HTTPStatusCode from "http-status-codes";
import * as express from "express";
import { EntityNotFound, Unauthorized } from "@binders/client/lib/clients/model";
import { InvitationEmailFail, LoginNotAvailable, UnknownDomain } from "./models/user";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

export class NotAllowed extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, NotAllowed.prototype);  // ES5 >= requirement
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export default function userErrorHandler(err: any, req: WebRequest, res: express.Response, next: express.NextFunction): void {
    if (err.name === EntityNotFound.errorName) {
        if (req.logger) {
            req.logger.error("User not found", "userRepository", err);
        }
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({ error: "User could not be found." }));
        return;
    }
    if (err instanceof LoginNotAvailable) {
        if (req.logger) {
            req.logger.error("Login is already in use", "userRepository", err);
        }
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, JSON.stringify({ error: "Login already in use" }));
        return;
    }
    if (err instanceof Unauthorized) {
        req?.logger?.error(err.message, "authorization");
        finishRequest(req, res, HTTPStatusCode.UNAUTHORIZED, JSON.stringify({ error: err.publicMessage ?? "Unauthorized" }));
        return;
    }
    if (err instanceof InvalidArgument) {
        finishRequest(req, res, HTTPStatusCode.UNPROCESSABLE_ENTITY, JSON.stringify({ error: err.message }));
        return;
    }
    if (err instanceof UnknownDomain) {
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, JSON.stringify({ error: err.message }));
        return;
    }
    if (err.name === InvitationEmailFail.name) {
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, JSON.stringify({ error: err.reason }));
        return;
    }
    if (err.message === "Address not found in bounces table") {
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({ error: err.message }));
        return;
    }
    if (err instanceof NotAllowed) {
        finishRequest(req, res, HTTPStatusCode.METHOD_NOT_ALLOWED, JSON.stringify({ error: err.message }));
        return;
    }
    next(err);
}
