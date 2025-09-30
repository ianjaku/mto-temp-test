import * as HTTPStatusCodes from "http-status-codes";
import { AzureSSONotConfigured, LoginFailure } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { EntityNotFound, Unauthorized } from "@binders/client/lib/clients/model";
import { InvalidCredential, InvalidToken, LoginNotFound } from "./model";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function credentialsErrorHandler(err, req, res, next) {
    if (err.name === LoginFailure.NAME) {
        if (req.logger) {
            req.logger.error("Invalid credentials", "credentials", err);
        }
        finishRequest(req, res, HTTPStatusCodes.UNAUTHORIZED, JSON.stringify({ error: "Invalid credentials" }));
        return;
    }
    if (err.name === LoginNotFound.NAME) {
        if (req.logger) {
            req.logger.error("Invalid login", "credentials", err);
        }
        finishRequest(req, res, HTTPStatusCodes.UNAUTHORIZED, JSON.stringify({ error: "Invalid login" }));
        return;
    }
    if (err.name === InvalidToken.NAME) {
        if (req.logger) {
            req.logger.error("Invalid token", "credentials", err);
        }
        finishRequest(req, res, HTTPStatusCodes.UNAUTHORIZED, JSON.stringify({ error: "Invalid token" }));
        return;
    }
    if (err.name === AzureSSONotConfigured.NAME) {
        if (req.logger) {
            req.logger.error("Azure SSO is not configured.", "sso", err.tenantId);
        }
        finishRequest(req, res, HTTPStatusCodes.PRECONDITION_FAILED, JSON.stringify({error: "SSO not configured"}));
        return;
    }
    if (err.name === EntityNotFound.errorName) {
        if (req.logger) {
            req.logger.error("Entity could not be found.", "dao");
        }
        finishRequest(req, res, HTTPStatusCodes.NOT_FOUND, JSON.stringify({error: "Entity not found"}))
        return;
    }
    if (err.name === "TokenExpiredError") {
        if (req.logger) {
            req.logger.error("Token is expired", "jwt");
        }
        finishRequest(req, res, HTTPStatusCodes.UNAUTHORIZED, JSON.stringify({error: "Token is expired"}));
        return;
    }
    if (err.name === "ExpiredSession") {
        if (req.logger) {
            req.logger.error(`Session with id ${err.sessionId} not found while creating access token`, "session");
        }
        finishRequest(req, res, HTTPStatusCodes.NOT_FOUND, JSON.stringify({error: err.message}));
        return;
    }
    if (err instanceof InvalidCredential) {
        if (req.logger) {
            req.logger.error("Invalid credential information", "credential");
        }
        finishRequest(req, res, HTTPStatusCodes.UNAUTHORIZED, JSON.stringify({error: err.message}));
        return;
    }
    if (err instanceof Unauthorized) {
        req.logger.error(err.message, "credential");
        finishRequest(req, res, HTTPStatusCodes.UNAUTHORIZED, JSON.stringify({ error: err.publicMessage ?? "Unauthorized" }));
        return;
    }
    next(err);
}
