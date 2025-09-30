import * as HTTPStatusCodes from "http-status-codes";
import {
    ClientError,
    ClientRequestOptions,
    RequestHandler,
    buildPath,
    buildQueryString,
    filterQueryParams
} from "./client";
import { FrontendException, captureFrontendException } from "../thirdparty/tracking/capture";
import {
    UnsupportedAudioCodec,
    UnsupportedMedia,
    UnsupportedMime,
    UnsupportedVideoCodec
} from "./imageservice/v1/visuals";
import {
    setServiceNotReachable,
    setServiceReachable
} from "../react/serviceconnectionstate/store";
import { AppRoute } from "./routes";
import { HttpResponse } from "./contract";
import TokenStore from "./tokenstore";
import { UiErrorCode } from "../errors";
import { UploadAttachments } from "./imageservice/v1/contract";
import agent from "superagent";
import { getBindersConfig } from "./config";
import { pick } from "ramda";

async function buildClientRequest<T>(routePrefix: string, route: AppRoute, options: ClientRequestOptions): Promise<HttpResponse<T> | boolean> {
    const uri = routePrefix + buildPath(route, options) + buildQueryString(options.queryParams);
    if (options.beacon) {
        return sendWithBeacon(uri, options.body);
    }

    try {
        const fetchResponse = await fetch(
            uri,
            {
                method: route.verb,
                headers: {
                    ...options.headers,
                    ...(options.skipJson !== true ? { "Accept": "application/json" } : {}),
                    ...(options.body ? { "Content-Type": "application/json" } : {}),
                } as Record<string, string>,
                ...(options.body ? { body: JSON.stringify(options.body) } : {}),
            }
        );

        if (!fetchResponse || fetchResponse.status === 0) {
            setServiceNotReachable();
            const msg = `Error in ${route.verb} to ${uri}: ${!fetchResponse ? "no response" : "status 0"}`;
            // eslint-disable-next-line no-console
            console.error(msg);
            throw new Error(msg);
        }

        setServiceReachable();
        const headers = {};
        fetchResponse.headers.forEach((value, key) => {
            headers[key] = value;
        });
        const rawBody = await fetchResponse.text();
        let body: T;
        try {
            body = JSON.parse(rawBody);
        } catch (error) {
            body = rawBody as unknown as T;
        }
        if (!fetchResponse.ok) { // catches 4xx and 5xx responses
            captureFrontendException(
                FrontendException.ApiUnexpectedStatusCode,
                {
                    uri,
                    status: fetchResponse.status,
                    statusText: fetchResponse.statusText,
                    body: rawBody,
                    headers: JSON.stringify(headers),
                }
            )
        }
        return {
            ...pick(["status", "statusText", "type", "url"], fetchResponse),
            statusCode: fetchResponse.status,
            headers,
            body,
        };
    } catch (error) {
        if (error?.message?.includes("Request has been terminated")) {
            setServiceNotReachable();
        }
        throw error;
    }
}

function sendWithBeacon(uri: string, data): boolean {
    if (window) {
        let toSend = data;
        if (typeof data === "object") {
            /*
                Below is the correct solution for setting the Content-Type. But there is a bug in chrome
                causing the code below to throw a nasty error.
            */
            // const headers = {
            //     type: "application/json"
            // };
            // toSend = new Blob(JSON.stringify(data), headers);
            toSend = JSON.stringify(data);
        }
        return window.navigator.sendBeacon(uri, toSend);
    }
    return false;
}

function convertToWsPath(path: string): string {
    const parts = path.split("://");
    const prefix = path.startsWith("https://") ?
        "wss://" :
        "ws://";
    return parts.length === 2 ?
        `${prefix}${parts[1]}` :
        path;
}

export function buildJWTAuthHeader(token: string): Record<string, string> {
    if (token == null) return {};
    return {
        Authorization: "JWT " + token
    };
}

export enum AuthType {
    NoAuth = "no-auth",
    Always = "always-auth",
    OnlyInternal = "only-internal",
    Backend = "backend"
}

export class BrowserRequestHandler extends RequestHandler {

    /**
     * @param authType
     *      {@link AuthType.NoAuth} -> Never add the auth header<br>
     *      {@link AuthType.Always} -> Always send auth header, even when on an account the user has no access to (in reader)<br>
     *      {@link AuthType.OnlyInternal} -> Only send the auth header when on an account the user has access to (in reader)<br>
     * @param extraHeaders - additional headers to include
     */
    constructor(
        private readonly authType: AuthType,
        private readonly extraHeaders = {}
    ) {
        super();
    }

    async handle<T>(routePrefix: string, route: AppRoute, options: ClientRequestOptions): Promise<T> {
        try {
            return await super.handle(routePrefix, route, options);
        } catch (e) {
            if (isInvalidSessionError(e)) {
                window.location.href = `/logout?reason=${UiErrorCode.sessionEnd}`;
            }
            throw e;
        }
    }

    private async createAuthHeader(useDeviceTargetUserToken?: boolean) {
        if (this.authType === AuthType.NoAuth) return {};
        if (this.authType === AuthType.Backend) return buildJWTAuthHeader(getBindersConfig().backendToken)
        const token = await TokenStore.fetchToken(
            this.authType === "always-auth",
            !useDeviceTargetUserToken
        );
        return buildJWTAuthHeader(token);
    }

    async buildRequestPromise<T>(
        routePrefix: string,
        route: AppRoute,
        options: ClientRequestOptions
    ): Promise<HttpResponse<T> | boolean> {
        const authHeader = await this.createAuthHeader(options.useDeviceTargetUserToken);
        const headersWithAZ = options.headers ?
            Object.assign(this.extraHeaders, options.headers, authHeader) :
            Object.assign(this.extraHeaders, authHeader);
        const updatedOptions = {
            ...options,
            headers: headersWithAZ,
            queryParams: filterQueryParams(options.queryParams)
        };
        return buildClientRequest<T>(routePrefix, route, updatedOptions);
    }

    async handleWsConnect(uri: string): Promise<WebSocket> {
        const token = await TokenStore.fetchToken(false);
        const wsPath = convertToWsPath(uri);
        return new WebSocket(wsPath, token);
    }

    async uploadFormRequest<T>(
        acceptedCode: number,
        method: string,
        url: string,
        headers: Record<string, string>,
        attachments: UploadAttachments,
        onProgress?: (clientId: string, percentage: number) => void,
        onEnd?: () => void,
    ): Promise<T> {
        const authHeader = await this.createAuthHeader();
        let req = agent(method, url);
        const headersWithAZ = headers ?
            Object.assign(this.extraHeaders, headers, authHeader) :
            Object.assign(this.extraHeaders, authHeader);
        req = Object.keys(headersWithAZ).reduce((acc, key) => {
            return acc.set(key, headersWithAZ[key as string]);
        }, req);

        req = Object.keys(attachments).reduce((acc, key) => {
            return attachments[key].reduce((reqAcc: agent.Request, val) => {
                return reqAcc
                    .attach(key, val)
                    .on("progress", (e) => { if (onProgress) { onProgress(val.clientId, parseInt(e.percent)); } });
            }, acc);
        }, req);
        const reqEnd: agent.SuperAgentRequest["end"] = req.end.bind(req);
        // Fire the request using .end()
        return new Promise((resolve, reject) => {
            reqEnd((error, response) => {
                if (typeof onEnd === "function") {
                    onEnd();
                }
                if (error) {
                    if (response?.text) {
                        return this.handleFormRequestError(error, response, reject);
                    }
                    return reject(new ClientError(response?.statusCode || HTTPStatusCodes.INTERNAL_SERVER_ERROR, error));
                }
                if (acceptedCode !== response.statusCode) {
                    const clientError = new ClientError(response.statusCode, response.body);
                    reject(clientError);
                    return;
                }
                return resolve(response.body);
            });
        });
    }

    async forwardUploadRequest<T>(
        _acceptedCode: number,
        _method: string,
        _url: string,
        _requestStream: unknown,
        _requestHeaders: Record<string, string>
    ): Promise<T> {
        throw new Error("forwardUploadRequest not supported in browser client");
    }

    private handleFormRequestError(error: unknown, response: agent.Response, reject: (error: unknown) => void) {
        try {
            const parsedError = JSON.parse(response.text);
            switch (parsedError.name) {
                case UnsupportedAudioCodec.NAME:
                    return reject(new UnsupportedAudioCodec(parsedError.codec));
                case UnsupportedVideoCodec.NAME:
                    return reject(new UnsupportedVideoCodec(parsedError.codec));
                case UnsupportedMedia.NAME:
                    return reject(new UnsupportedMedia(parsedError.translationKey, parsedError.translationParams));
                case UnsupportedMime.NAME:
                    return reject(new UnsupportedMime(parsedError.mime))
            }
        } finally {
            const errorDetails = response.text ? { text: response.text } : error;
            // eslint-disable-next-line no-unsafe-finally
            return reject(new ClientError(response.statusCode, errorDetails));
        }
    }

    supportsDetailedStackTrace(): boolean {
        return false;
    }
}

function isInvalidSessionError(e: unknown): boolean {
    return e instanceof ClientError &&
        e.statusCode === HTTPStatusCodes.FORBIDDEN &&
        e.message.startsWith("Request was blocked");
}

export default new BrowserRequestHandler(AuthType.OnlyInternal);
export const externalUserHandler = new BrowserRequestHandler(AuthType.Always);
export const noAuthHandler = new BrowserRequestHandler(AuthType.NoAuth);
