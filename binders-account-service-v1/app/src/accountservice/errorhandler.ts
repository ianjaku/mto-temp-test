import * as HTTPStatusCode from "http-status-codes";
import * as express from "express";
import { MSSetupRequestNotFound, MSSubscriptionAlreadyExists } from "./service";
import { AccountNotFound } from "@binders/client/lib/clients/accountservice/v1/contract";
import { EntityNotFound } from "@binders/client/lib/clients/model";
import { MSTransactableInvalidToken } from "@binders/binders-service-common/lib/mstransactableoffers";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export default function accountErrorHandler (err: any, req: WebRequest, res: express.Response, next: express.NextFunction): void {
    if (err instanceof AccountNotFound) {
        if (req.logger) {
            req.logger.error("Account not found", "userRepository", err);
        }
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({error: "Account not found"}));
        return;
    }
    if (err.name === MSSetupRequestNotFound.name) {
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({error: err.message}));
        return;
    }
    if (err.name === MSSubscriptionAlreadyExists.name) {
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, JSON.stringify({error: err.message}));
        return;
    }
    if (err.name === EntityNotFound.name) {
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({error: err.message}));
    }
    if (err.name === MSTransactableInvalidToken.name) {
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, JSON.stringify({error: "The provided token is invalid"}))
    }
    if (err.name === MSSetupRequestNotFound.name) {
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({error: err.message}));
        return;
    }
    if (err.name === MSSubscriptionAlreadyExists.name) {
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, JSON.stringify({error: err.message}));
        return;
    }
    if (err.name === EntityNotFound.name) {
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({error: err.message}));
        return;
    }
    next(err);
}
