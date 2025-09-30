import * as express from "express";
import { BackendUserServiceClient } from "../apiclient/backendclient";
import { BindersConfig } from "../bindersconfig/binders";
import { WebRequest } from "../middleware/request";
import { finishRequest } from "../middleware/routes";

interface WhoAmIResponse {
    uid: string;
    login: string;
    sessionId: string;
}

const NOT_AVAILABLE = "n/a";

async function extractUserData(request: WebRequest): Promise<{uid: string, login: string, sessionId: string}> {
    if (!request.user) {
        return {
            uid: NOT_AVAILABLE,
            login: NOT_AVAILABLE,
            sessionId: NOT_AVAILABLE
        }
    }
    const { sessionId, userId: uid } = request.user;
    const config = BindersConfig.get();
    const userBackend = await BackendUserServiceClient.fromConfig(config, "who-am-i");
    const user = await userBackend.getUser(uid);
    return {
        uid,
        login: user.login,
        sessionId
    }
}

async function getResponseData(request: WebRequest): Promise<WhoAmIResponse> {
    const { sessionId, uid, login } = await extractUserData(request);
    return {
        uid,
        login,
        sessionId
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default async (
    request: WebRequest,
    response: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction
) => {
    const responseData = await getResponseData(request);
    finishRequest(request, response, 200, JSON.stringify(responseData));
}