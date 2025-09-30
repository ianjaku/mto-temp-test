import * as express from "express";
import { WebRequest } from "../middleware/request";
import { fileExists } from "../files/util";
import { finishRequest } from "../middleware/routes";
import { readFileSync } from "fs";

type BuildInfoResult = "noFile" | "corruptOrEmpty" | { info: { commit: string, branch: string } };

export const getBuildInfo = async (): Promise<BuildInfoResult> => {
    const buildinfoPath = "/app/buildinfo.json";
    const infoPresent = await fileExists(buildinfoPath);
    if (!infoPresent) {
        return "noFile";
    }
    const buildinfoContent = readFileSync(buildinfoPath).toString();
    const buildinfo = buildinfoContent && JSON.parse(buildinfoContent);
    if (!buildinfo) {
        return "corruptOrEmpty"
    }
    return {info: buildinfo};
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default async (
    request: WebRequest,
    response: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction
) => {
    const infoResult = await getBuildInfo();
    if (infoResult === "noFile") {
        return finishRequest(
            request,
            response,
            404,
            JSON.stringify({error: "No buildinfo available"})
        );
    }
    if (infoResult == "corruptOrEmpty") {
        return finishRequest(
            request,
            response,
            500,
            JSON.stringify({error: "Could not decode build info"})
        );
    }
    return finishRequest(request, response, 200, JSON.stringify(infoResult.info));
}