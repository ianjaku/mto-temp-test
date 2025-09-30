import * as express from "express";
import { WebRequest } from "../middleware/request";

export default async (request: WebRequest, response: express.Response): Promise<Record<string, unknown>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.send("Heap dump disabled for now") as any;
}