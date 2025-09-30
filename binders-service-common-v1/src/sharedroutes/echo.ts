import * as express from "express";
import { WebRequest } from "../middleware/request";
import { finishRequest } from "../middleware/routes";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default async (
    request: WebRequest,
    response: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction
) => {
    const headers = {
        ...request.headers
    };
    delete headers["cookie"];
    const cookies = request.cookies;
    let { toEcho } = request.body;
    if (toEcho === undefined) {
        toEcho = JSON.stringify(request.body);
    }
    const responseToSend = {
        headers,
        cookies,
        echo: toEcho
    }
    if (request.logger) {
        request.logger.info(toEcho, "echo-request");
    }
    finishRequest(request, response, 200, JSON.stringify(responseToSend));
}
