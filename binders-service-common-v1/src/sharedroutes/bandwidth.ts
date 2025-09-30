import * as express from "express";
import { WebRequest } from "../middleware/request";
import { finishRequest } from "../middleware/routes";

const MAX_SAMPLE_SIZE = 64*1024*1024;

const buildBody = async (sampleSize) => {
    return "0".repeat(sampleSize);
}

export default async (
    request: WebRequest,
    response: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction
): Promise<void> => {
    const sampleSize = request.body.sampleSize;
    const sanitizedSampleSize = Math.min(MAX_SAMPLE_SIZE, sampleSize);
    const body = await buildBody(sanitizedSampleSize);
    finishRequest(request, response, 200, JSON.stringify(body));
}