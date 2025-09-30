/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as FormData from "form-data";
import * as WebSocket from "ws";
import {
    ClientRequestOptions,
    RequestHandler,
    buildPath,
    filterQueryParams
} from "@binders/client/lib/clients/client";
import { JWTSignConfig, signJWT } from "../tokens/jwt";
import { AppRoute } from "@binders/client/lib/clients/routes";
import { BackendSession } from "../middleware/authentication";
import { CORRELATION_KEY_HTTP_HEADER } from "../util/logging";
import { HttpResponse } from "@binders/client/lib/clients/contract";
import { UploadAttachments } from "@binders/client/lib/clients/imageservice/v1/contract";
import { WebRequest } from "../middleware/request";
import fetch from "node-fetch";
import { getRequestContext } from "../middleware/asyncLocalStorage";
import { parseBodyInFetchResponse } from "./helpers";


async function tryFetch(uri: string, route: AppRoute, options: ClientRequestOptions, retry = true): Promise<fetch.Response> {
    try {
        return await fetch(
            uri,
            {
                method: route.verb,
                ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
                ...(options.body ? { body: JSON.stringify(options.body) } : {}),
                ...(options.headers ? { headers: options.headers } : {}),
            }
        );
    } catch (error) {
        if (retry && error.code === "ECONNRESET") {
            return tryFetch(uri, route, options, false);
        }
        throw error;
    }
}
async function buildRequestPromise<T>(
    routePrefix: string,
    route: AppRoute,
    options: ClientRequestOptions
): Promise<HttpResponse<T>> {
    let uri = routePrefix + buildPath(route, options);
    const queryParams = options.queryParams ? filterQueryParams(options.queryParams) : {};

    if (Object.keys(queryParams).length) {
        const urlSearchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(queryParams)) {
            urlSearchParams.append(key, `${value}`);
        }
        uri += "?" + urlSearchParams.toString();

    }

    const fetchResponse = await tryFetch(uri, route, options);
    const body = await parseBodyInFetchResponse<T>(fetchResponse);
    return {
        status: fetchResponse.status,
        statusCode: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: Object.fromEntries(fetchResponse.headers.entries()),
        body,
    }
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

export class NodeClientHandler extends RequestHandler {
    constructor(private requestToken?: string) {
        super();
    }

    private addAuthorizationHeader(options: ClientRequestOptions): ClientRequestOptions {
        if (this.requestToken == null) {
            return options;
        }
        const headers = options.headers ? Object.assign({}, options.headers) : {};
        headers["Authorization"] = `JWT ${this.requestToken}`;
        return Object.assign({}, options, { headers });
    }

    buildRequestPromise<T>(routePrefix: string, route: AppRoute, options: ClientRequestOptions): Promise<HttpResponse<T>> {
        const withAzHeader = this.addAuthorizationHeader(options);
        const withCorrelationKey = this.addCorrelationKeyHeader(withAzHeader);
        return buildRequestPromise<T>(routePrefix, route, withCorrelationKey);
    }

    addCorrelationKeyHeader(options: ClientRequestOptions): ClientRequestOptions {
        const requestContext = getRequestContext();
        if (requestContext && requestContext.correlationKey) {
            const headers = {
                ...options.headers,
                [CORRELATION_KEY_HTTP_HEADER]: requestContext.correlationKey
            }
            return {
                ...options,
                headers
            }
        }
        return options;
    }

    static async forUser(jwtConfig: JWTSignConfig, userId: string): Promise<NodeClientHandler> {
        const toSign = { userId };
        const token = await signJWT(toSign, jwtConfig);
        return new NodeClientHandler(token);
    }

    static async forBackend(jwtConfig: JWTSignConfig, service: string): Promise<NodeClientHandler> {
        const toSign: BackendSession = {
            sessionId: `ses-${service}`,
            userId: `uid-${service}`,
            accountIds: [],
            isBackend: true,
            identityProvider: "backend"
        };
        const token = await signJWT(toSign, jwtConfig);
        return new NodeClientHandler(token);
    }

    setRequestToken(token: string): void {
        this.requestToken = token;
    }

    async handleWsConnect(uri: string) {
        const wsPath = convertToWsPath(uri);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new WebSocket(wsPath, this.requestToken) as any;
    }

    async uploadFormRequest<T>(
        _acceptedCode: number,
        method: string,
        url: string,
        headers: Record<string, string>,
        attachments: UploadAttachments,
        _onProgress?: (clientId: string, percent: number) => void,
        _onEnd?: () => void
    ): Promise<T> {
        const headersWithAuth = this.addAuthorizationHeader(headers);
        const formData = new FormData();

        if (attachments.image) {
            attachments.image.forEach(imageStream => formData.append("image", imageStream));
        }
        if (attachments.logo) {
            attachments.logo.forEach(logoStream => formData.append("logo", logoStream));
        }
        const fetchResponse = await fetch(url, {
            method,
            headers: { ...headersWithAuth.headers },
            body: formData,
        });

        if (!fetchResponse.ok) {
            throw new Error(`HTTP error: status ${fetchResponse.status} on ${method} ${url}`);
        }
        const jsonResponse = await fetchResponse.json();
        return jsonResponse as T;
    }

    async forwardUploadRequest<T>(
        _acceptedCode: number,
        method: string,
        url: string,
        requestStream: WebRequest,
        requestHeaders: Record<string, string>
    ): Promise<T> {
        const headersWithAuth = this.addAuthorizationHeader({ headers: requestHeaders });

        const fetchResponse = await fetch(url, {
            method,
            body: requestStream,
            headers: {
                ...headersWithAuth.headers,
                host: undefined, // Remove host header to avoid conflicts
            },
        });

        if (!fetchResponse.ok) {
            throw new Error(`HTTP error: status ${fetchResponse.status} on ${method} ${url}`);
        }
        const jsonResponse = await fetchResponse.json();
        return jsonResponse as T;
    }


    supportsDetailedStackTrace(): boolean {
        return true;
    }
}

const instance: RequestHandler = new NodeClientHandler();
export default instance;
