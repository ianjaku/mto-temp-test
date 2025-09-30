import * as express from "express";
import { WebRequest } from "../middleware/request";
import { finishRequest } from "../middleware/routes";

export default async (
    request: WebRequest,
    response: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction
): Promise<void> => {
    finishRequest(request, response, 200, JSON.stringify("Healthy"));
};