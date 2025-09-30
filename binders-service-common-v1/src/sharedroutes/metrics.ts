import * as express from "express";
import { exportPrometheusMetrics, getClientContentType } from "../monitoring/prometheus";
import { WebRequest } from "../middleware/request";
import { finishRequest } from "../middleware/routes";

export default async (
    request: WebRequest,
    response: express.Response,
    _next: express.NextFunction
): Promise<void> => {
    const metrics = exportPrometheusMetrics();
    const contentType = getClientContentType()
    finishRequest(request, response, 200, metrics, false, contentType);
};