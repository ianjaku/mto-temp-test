import { NextFunction, Response } from "express";
import { WebRequest } from "./request";

const redirects = {
    "new-editor.manual.to": "https://editor.manual.to"
}

export const setupRedirects = () => {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    return (request: WebRequest, response: Response, next: NextFunction) => {
        const hostname = request.hostname;
        if (hostname in redirects) {
            // Validated safe for redirect
            // Redirects to a allowlisted domain
            response.redirect(301, redirects[hostname]);
            return;
        }
        next();
    }
}