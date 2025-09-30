import * as agent from "superagent";
import {
    ClientRequestOptions,
    RequestHandler,
} from "@binders/client/lib/clients/client";
import { ResponseFormat, getContentTypeHeaderForFormat } from "../middleware/response/response";
import {
    buildPath,
    buildQueryString,
    filterQueryParams
} from "@binders/client/lib/clients/client";
import { AppRoute } from "@binders/client/lib/clients/routes";
import { UploadAttachments } from "@binders/client/lib/clients/imageservice/v1/contract";

function buildClientRequest(routePrefix: string, route: AppRoute, options: ClientRequestOptions, format: ResponseFormat) {
    const uri = routePrefix + buildPath(route, options) + buildQueryString(options.queryParams);
    if (options.beacon) {
        throw new Error("sendBeacon not implemented in integration tests");
    }
    let request = agent(route.verb, uri);
    for (const key in options.headers) {
        request = request.set(key, options.headers[key]);
    }
    if (options.skipJson !== true && format === ResponseFormat.JSON) {
        request = request.set("Accept", "application/json");
    }
    if (options.body) {
        request = request.set("Content-Type", getContentTypeHeaderForFormat(format));
        request = request.send(options.body);
    }
    return new Promise((resolve, reject) => {
        request.end((error, response) => {
            const requestTerminatedErr = error?.message?.includes("Request has been terminated");
            if (requestTerminatedErr || response.status === 0) {
                return reject(error);
            }
            return resolve(response);
        });
    });
}

export class TestRequestHandler extends RequestHandler {

    constructor(
        private readonly token?: string,
        private readonly tokenPrefix = "JWT",
        private readonly accountId?: string,
        private readonly preferredFormat = ResponseFormat.JSON
    ) {
        super();
    }

    private async createAuthHeader() {
        if (this.token == null) return {};
        if (this.tokenPrefix == null) {
            return { Authorization: this.token };
        }
        return { Authorization: this.tokenPrefix + " " + this.token };
    }

    async buildRequestPromise(
        routePrefix: string,
        route: AppRoute,
        options: ClientRequestOptions
    ): Promise<unknown> {
        const authHeader = await this.createAuthHeader();
        const updatedOptions = {
            ...options,
            headers: {
                ...options.headers,
                ...authHeader,
                // Used in testing of the public Api, in prod the domain will be used to verify the accountId
                ...(this.accountId != null ? { accountId: this.accountId } : {}) 
            },
            queryParams: filterQueryParams(options.queryParams)
        }
        return buildClientRequest(routePrefix, route, updatedOptions, this.preferredFormat);
    }

    handleWsConnect(_uri: string): Promise<WebSocket> {
        throw new Error("handleWsConnect has not yet been implemented for tests.");
    }

    uploadFormRequest<T>(
        _acceptedCode: number,
        _method: string,
        _url: string,
        _headers: Record<string, string>,
        _attachments: UploadAttachments,
        _onProgress?: (clientId: string, percent: number) => void,
        _onEnd?: () => void
    ): Promise<T> {
        throw new Error("Form requests have not yet been implemented for tests.");
    }

    async forwardUploadRequest<T>(
        _acceptedCode: number,
        _method: string,
        _url: string,
        _requestStream: unknown,
        _requestHeaders: Record<string, string>
    ): Promise<T> {
        throw new Error("Forward upload requests have not yet been implemented for tests.");
    }

    supportsDetailedStackTrace(): boolean {
        return false;
    }
}
