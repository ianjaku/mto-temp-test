import * as HTTPStatusCode from "http-status-codes";
import {
    BinderHasPublicationError,
    CircularPathError,
    CollectionLastTitle,
    CollectionNotEmpty,
    InvalidBinder,
    InvalidParam,
    InvalidRecursiveActionOpeartion,
    ItemInstanceAlreadyInCollectionError,
    NonExistingDomainFilter,
    NonExistingItem,
    NothingToPublish,
    UnsupportedLanguageError,
    WillNotOrphan
} from "./model";
import { EntityNotFound, ResourceNotFound, Unauthorized } from "@binders/client/lib/clients/model";
import {
    NothingToUnpublish,
    isChecklistAlreadyInStateError
} from  "@binders/client/lib/clients/repositoryservice/v3/errors";
import type { ErrorRequestHandler } from "express";
import { NoVideoFormatsError } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { VoiceNotFound } from "@binders/binders-service-common/lib/tts/errors/voice_not_found";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

const repositoryErrorHandler: ErrorRequestHandler = (err, req: WebRequest, res, next) => {
    // TODO - switch to abstract handle function below
    if (err.name === EntityNotFound.errorName || err.message === "Not Found" ) {
        if (req.logger) {
            req.logger.error("Document not found", "binder-store", err);
        }
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({error: "Binder could not be found."}));
        return;
    }
    if (err.name === InvalidBinder.NAME) {
        if (req.logger) {
            req.logger.error("Invalid binder received", "binder-validation")
            req.logger.logException(err, "binder-validation");
        }
        const response = JSON.stringify({error: "Invalid binder format", details: (err as InvalidBinder).validationErrors});
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === InvalidParam.NAME) {
        if (req.logger) {
            req.logger.error("Invalid parameter supplied to endpoint", "param-validation", err);
        }
        const response = JSON.stringify({error: "Invalid parameter supplied", details: (err as InvalidParam).validationErrors});
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === InvalidRecursiveActionOpeartion.NAME) {
        if (req.logger) {
            req.logger.error("Invalid recursive action operation received", "binder-validation", err);
        }
        const response = JSON.stringify({error: "Invalid recursive action operation received", details: (err as InvalidRecursiveActionOpeartion).operation});
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === WillNotOrphan.NAME) {
        if (req.logger) {
            req.logger.debug("Cannot orphan document", "collection-edit", err);
        }
        const response = JSON.stringify({error: err.message});
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === CollectionNotEmpty.NAME) {
        if (req.logger) {
            req.logger.debug(err.message, "collection-delete", err);
        }
        const response = JSON.stringify({error: err.message});
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === CollectionLastTitle.NAME) {
        if (req.logger) {
            req.logger.debug(err.message, "collection-edit", err);
        }
        const response = JSON.stringify({ error: err.message });
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === BinderHasPublicationError.NAME) {
        if (req.logger) {
            req.logger.debug(err.message, "binder-delete", err);
        }
        const response = JSON.stringify({ error: err.message });
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === NonExistingDomainFilter.NAME) {
        if (req.logger) {
            req.logger.debug("Domain doesn't exist", "domainfilters", err);
        }
        const response = JSON.stringify({error: err.message});
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, response);
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (err.name === NonExistingItem.NAME || (err as any).statusCode === 404) {
        if (req.logger) {
            req.logger.debug( "Item doesn't exist", "item", err);
        }
        const response = JSON.stringify({error: err.message});
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, response);
        return;
    }
    if (err.name === Unauthorized.NAME) {
        if (req.logger) {
            req.logger.debug("Not authorized", "az-check", err);
        }
        const response = JSON.stringify({error: err.message});
        finishRequest(req, res, HTTPStatusCode.UNAUTHORIZED, response);
        return;
    }
    if (isChecklistAlreadyInStateError(err)) {
        const response = JSON.stringify({
            name: err.name,
            message: err.message,
            checklist: err.checklist,
        });
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === CircularPathError.NAME) {
        if (req.logger) {
            req.logger.debug(err.message, "collection-edit", err);
        }
        const response = JSON.stringify({error: { message: err.message, name: CircularPathError.NAME }});
        finishRequest(req, res, HTTPStatusCode.INTERNAL_SERVER_ERROR, response);
        return;
    }
    if (err.name === ItemInstanceAlreadyInCollectionError.NAME) {
        req?.logger.debug(err.message, "collection-edit");
        const response = JSON.stringify({ error: { message: err.message, name: ItemInstanceAlreadyInCollectionError.NAME } });
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === UnsupportedLanguageError.NAME) {
        if (req.logger) {
            req.logger.debug(err.message, "translation", err);
        }
        const response = JSON.stringify({
            error: {
                message: err.message,
                name: UnsupportedLanguageError.NAME,
                languageCodes: (err as UnsupportedLanguageError).languageCodes
            }
        });
        finishRequest(req, res, HTTPStatusCode.INTERNAL_SERVER_ERROR, response);
        return;
    }
    if (err.name === NoVideoFormatsError.NAME) {
        if (req.logger) {
            req.logger.debug(err.message, "pdf-export", err);
        }
        const response = JSON.stringify({error: { message: err.message, name: NoVideoFormatsError.NAME }});
        finishRequest(req, res, HTTPStatusCode.INTERNAL_SERVER_ERROR, response);
        return;
    }
    if (err.name === NothingToUnpublish.NAME) {
        const response = JSON.stringify({error: { message: err.message, name: err.name}});
        finishRequest(req, res, HTTPStatusCode.INTERNAL_SERVER_ERROR, response);
        return;
    }
    if (err.name === NothingToPublish.NAME) {
        const response = JSON.stringify({error: { message: err.message, name: err.name}});
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err.name === VoiceNotFound.NAME) {
        const response = JSON.stringify({error: { message: err.message, name: err.name }});
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, response);
        return;
    }
    if (err instanceof ResourceNotFound) {
        req?.logger?.error(`Could not find resource path ${req.url}`, "repository-error");
        finishRequest(req, res, HTTPStatusCode.NOT_FOUND, JSON.stringify({ error: { message: err.message } }));
        return;
    }
    next(err);
}

export default repositoryErrorHandler;
