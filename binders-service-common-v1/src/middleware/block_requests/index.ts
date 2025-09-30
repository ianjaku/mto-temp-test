import * as HTTPStatusCode from "http-status-codes";
import * as ejs from "ejs";
import * as fs from "fs";
import { RequestBlocker, RequestBlockerOptions, getRedisClient } from "./request_blocker";
import type { RequestHandler, Response } from "express";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";
import { LoggerBuilder } from "../../util/logging";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { WebRequest } from "../request";
import { extractInterfaceLanguageFromRequest } from  "../../util/i18n";
import { getDomainFromRequest } from  "../../util/domains";
import i18next from "@binders/client/lib/i18n";
import { isProduction } from "@binders/client/lib/util/environment";

const blockedTemplateFile = () => fs.realpathSync("./public/blocked.html");
let memoizedBlockedContents: string | undefined = undefined;
const blockFileContents = () => {
    if (!memoizedBlockedContents) {
        memoizedBlockedContents = fs.readFileSync(blockedTemplateFile(), "utf8");
    }
    return memoizedBlockedContents;
};

async function renderBlockedTemplate(request: WebRequest) {
    const domain = getDomainFromRequest(request, Application.READER, { returnOnlySubdomain: false });
    const contents = isProduction() ?
        blockFileContents() :
        fs.readFileSync(blockedTemplateFile(), "utf8");
    const interfaceLanguage = await extractInterfaceLanguageFromRequest(request, {domain})
    const t = (key: string): string => i18next.t(key, { lng: interfaceLanguage });

    const templateData = {
        title: t(TranslationKeys.General_ReqestBlockedTitle),
        info: t(TranslationKeys.General_ReqestBlockedDescription),
        action: t(TranslationKeys.User_Login),
    };
    return ejs.render(contents, templateData, {});
}

export async function blockRequest(request: WebRequest, response: Response): Promise<void> {
    response.status(HTTPStatusCode.FORBIDDEN);
    response.set("Pragma", "no-cache");
    response.set("Cache-Control", "no-cache,no-store");
    const content = await renderBlockedTemplate(request);
    response.send(content);
    response.end();
}

export function buildRequestBlockingRequestHandler(
    config: Config,
    options: RequestBlockerOptions = {}
): RequestHandler {
    const requestBlockRedisClient = getRedisClient(config);
    const logger = LoggerBuilder.fromConfig(config, "request-blocker");
    const clients = {
        requestBlockers: requestBlockRedisClient,
        sessions: requestBlockRedisClient,
    };
    const blocker = new RequestBlocker(
        logger,
        clients,
        {
            ...options,
            debug: false
        }
    );
    return async function(request: WebRequest, response, next) {
        try {
            if (await blocker.shouldBlockRequest(request)) {
                return await blockRequest(request, response);
            } else {
                next();
            }
        } catch (err) {
            next(err);
        }
    }
}
