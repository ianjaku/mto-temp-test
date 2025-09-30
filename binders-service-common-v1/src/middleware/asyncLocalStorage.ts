import { AccountFeatures, IAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { NextFunction, Response } from "express";
import { Logger } from "../util/logging";
import { WebRequest } from "./request";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AsyncLocalStorage } = require("async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();

export interface RequestContext {
    correlationKey: string;
    logger: Logger;
    accountId?: string;
    accountFeatures?: AccountFeatures;
    accountSettings?: IAccountSettings;
}

export function initializeRequestContext(req: WebRequest, res: Response, next: NextFunction): void {
    const context = {
        correlationKey: req.logger.correlationKey ?? "",
        logger: req.logger,
    };
    asyncLocalStorage.run(context, async () => {
        return next();
    });
}

export function getRequestContext(): RequestContext {
    return asyncLocalStorage.getStore();
}
