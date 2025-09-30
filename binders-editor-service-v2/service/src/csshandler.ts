import * as express from "express";
import * as fs from "fs";
import { NextFunction, Response } from "express";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { proxyGoogleFonts } from "@binders/binders-service-common/lib/util/googlefonts";

export function cssHandler(
    cssPath: string,
): express.RequestHandler {
    return async (request: WebRequest, response: Response, next: NextFunction) => {
        let css;
        try {
            const cssFileContents = fs.readFileSync(cssPath, "utf8");
            css = await proxyGoogleFonts(cssFileContents, request);
        } catch (error) {
            request?.logger?.error(`requested css file (${cssPath}) not found`, "cssHandler-editor");
            css = "";
        }
        try {
            response.setHeader("Content-Type", "text/css");
            response.setHeader("Content-Length", css.length.toString());
            response.send(css);
        }
        catch (error) {
            next(error);
        }
    }
}
