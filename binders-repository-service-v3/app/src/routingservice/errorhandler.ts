import * as HTTPStatusCode from "http-status-codes";
import { DomainNotFound, SemanticLinkAlreadyExist } from "./model";
import { ErrorRequestHandler, Response } from "express";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

const handleAPIError = (request: WebRequest,
    response: Response,
    error: Error,
    statusCode: number,
    logMessage: string,
    logCategory: string
) => {
    const { logger } = request;
    if (logger) {
        logger.debug(logMessage, logCategory, error);
    }
    const responseMessage = JSON.stringify({ error: error.message });
    finishRequest(request, response, statusCode, responseMessage);
};

const routingErrorHandler: ErrorRequestHandler = (err, req: WebRequest, res, next) => {
    if (err.name === SemanticLinkAlreadyExist.NAME) {
        return handleAPIError(req, res, err, HTTPStatusCode.EXPECTATION_FAILED, "Hyperlink already exists", "semanticlinks");
    }
    if (err.name === DomainNotFound.NAME) {
        return handleAPIError(req, res, err, HTTPStatusCode.NOT_FOUND, err.message, "domains");
    }
    next(err);
}

export default routingErrorHandler;