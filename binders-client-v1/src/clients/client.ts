import { AppRoute, SHARED_ROUTES } from "./routes";
import { ContentServiceErrorCode } from "./contentservice/v1/contract";
import { TK } from "../react/i18n/translations";
import { UploadAttachments } from "./imageservice/v1/contract";

/**
 * Lists all the available response formats for an export API
 */
export enum ClientExportApiResponseFormat {
    JSON = "json",
    CSV = "csv",
}

export class ClientError extends Error {

    static errorName = "BindersAPIError";

    constructor(
        public readonly statusCode: number,
        public readonly errorDetails: unknown,
    ) {
        super();
        this.message = `${this.formatError(errorDetails)} (${statusCode})`;
        this.name = ClientError.errorName;
    }

    /**
     * Attempts to parse the passed in error details to an actual message
     * @param errorDetails - likely in one of the following formats `{ text: string } | { message: string } | string`
     */
    private formatError(errorDetails: unknown): string {
        const errorText: string | undefined = errorDetails?.["text"] || errorDetails?.["message"];
        if (errorText) {
            try {
                const error = JSON.parse(errorText);
                if (error?.error) {
                    return error.error;
                }
            } catch (ex) {
                return errorText;
            }
        }
        return errorDetails?.toString?.() ?? "Client error";
    }
}

export type ClientV2ErrorData = {
    code: string;
    kind: string;
    message: string;
}

export class ClientV2Error extends Error {
    public code: string;
    public kind: string;
    public message: string;

    constructor(data: ClientV2ErrorData) {
        super();
        this.code = data.code
        this.kind = data.kind
        this.message = data.message
    }

    static from(data: unknown): ClientV2Error | null {
        if (!(typeof data === "object")) return null;
        if (!("kind" in data)) return null;
        const error = data as ClientV2ErrorData
        if (!error.kind) return null;
        return new ClientV2Error(error)
    }

    toLanguageErrorMsgKey(): string | null {
        switch (this.kind) {
            case "ContentServiceError":
                switch (this.code) {
                    case ContentServiceErrorCode.ContentFilter:
                        return TK.Edit_AiOptimizeFailedContentFilter;
                    case ContentServiceErrorCode.NoChoices:
                        return TK.Edit_AiOptimizeFailedNoChoices;
                    case ContentServiceErrorCode.ContentTooLarge:
                        return TK.Edit_AiOptimizeFailedContentTooLarge;
                    case ContentServiceErrorCode.EngineFail:
                        return TK.Edit_AiOptimizeFailedEngine;
                    case ContentServiceErrorCode.InvalidBinder:
                        return TK.Edit_AiOptimizeFailedInvalidEngineResponse;
                }
                break;
        }
        return null;
    }
}

export type QueryParams = Record<string, string | number>;

export interface ClientRequestOptions {
    // eslint-disable-next-line @typescript-eslint/ban-types
    pathParams?: Object;
    queryParams?: QueryParams;
    // eslint-disable-next-line @typescript-eslint/ban-types
    body?: Object;
    headers?: Record<string, string>;
    beacon?: boolean;
    timeout?: number;
    skipJson?: boolean;
    useDeviceTargetUserToken?: boolean;
}


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/ban-types
export function fillPathParams(path: string, params: Object) {
    const pattern = new RegExp("[:]([a-zA-Z]+)[?]?", "g");
    let matches = pattern.exec(path);
    let newPath = path;
    /* tslint:disable-next-line:no-null-keyword */
    while (matches !== null) {
        const match = matches[1];
        if (match in params) {
            newPath = newPath.replace(new RegExp(`:${match}[?]?`), params[match]);
        }
        matches = pattern.exec(path);
    }
    return newPath;
}

export function buildQueryString(queryParams?: Record<string, string | number | boolean | null | undefined>): string {
    if (queryParams == null) return "";
    const entries = Object.entries(queryParams).filter(([, value]) => value != null);
    if (entries.length === 0) return "";
    const params = entries.map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
    return `?${params.join("&")}`;
}

export function buildPath(route: AppRoute, options: ClientRequestOptions): string {
    if (options.pathParams) {
        return fillPathParams(route.path, options.pathParams);
    } else {
        return route.path;
    }
}

export abstract class RequestHandler {
    handle<T>(routePrefix: string,
        route: AppRoute,
        options: ClientRequestOptions
    ): Promise<T> {
        const requestPromise = this.buildRequestPromise(routePrefix, route, options);
        const acceptedCode = route.successStatus;
        const stackTrace = this.supportsDetailedStackTrace() ? new Error().stack : "";
        const createClientError = (statusCode: number, error: unknown): Error => {
            const v2error = ClientV2Error.from(error)
            if (v2error) return v2error;
            const clientError = new ClientError(statusCode, error);
            if (this.supportsDetailedStackTrace() && stackTrace) {
                clientError.stack = (clientError.stack ?? "") + "\n\n" + stackTrace;
            }
            return clientError;
        };

        return new Promise<T>((resolve, reject) => {
            requestPromise
                .then((response) => {
                    if (options.beacon) {
                        resolve(response);
                    }
                    if (acceptedCode !== response.statusCode) {
                        const errorDetails = response?.body?.error || response?.body || response;
                        reject(createClientError(response.statusCode, errorDetails));
                        return;
                    }
                    const isCsvContentType = response.headers["content-type"]?.includes("text/csv");
                    if (isCsvContentType && response.text != null) {
                        resolve(response.text);
                    } else {
                        resolve(response.body);
                    }
                }, (error: unknown) => {
                    return reject(createClientError(500, error));
                })
                .catch((error: unknown) => {
                    return reject(createClientError(500, error));
                });
        });
    }

    abstract handleWsConnect(uri: string): Promise<WebSocket>;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    abstract buildRequestPromise(routePrefix: string, route: AppRoute, options: ClientRequestOptions);

    abstract uploadFormRequest<T>(
        acceptedCode: number,
        method: string,
        url: string,
        headers: Record<string, string>,
        attachments: UploadAttachments,
        onProgress?: (clientId: string, percent: number) => void,
        onEnd?: () => void
    ): Promise<T>;

    abstract forwardUploadRequest<T>(
        acceptedCode: number,
        method: string,
        url: string,
        requestStream: unknown,
        requestHeaders: Record<string, string>
    ): Promise<T>;

    /**
     * Controls whether the client should expand its stack trace on failure
     */
    abstract supportsDetailedStackTrace(): boolean;
}

export class BindersServiceClient {

    constructor(
        protected endpointPrefix: string,
        protected routes: { [name: string]: AppRoute; },
        protected requestHandler: RequestHandler,
        protected accountIdProvider: () => string = () => undefined,
    ) {
    }

    private withInjectedAccountId(options: ClientRequestOptions): ClientRequestOptions {
        const providerAccountId = this.accountIdProvider();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const queryParamsAccountId = (options.queryParams as any)?.accountId;
        if (providerAccountId && !queryParamsAccountId) {
            options.queryParams = {
                ...options.queryParams,
                accountId: providerAccountId
            }
        }
        return options;
    }

    protected handleRequest<T>(routeName: keyof this, options: ClientRequestOptions): Promise<T> {
        const route = (routeName in SHARED_ROUTES) ?
            SHARED_ROUTES[<string>routeName] :
            this.routes[<string>routeName];
        return this.requestHandler.handle<T>(this.endpointPrefix, route, this.withInjectedAccountId(options));
    }

    protected handleUpload<T>(
        routeName: string,
        reqOptions: ClientRequestOptions,
        attachments: UploadAttachments,
        onProgress?: (visualId: string, percent: number) => void,
        onEnd?: () => void,
    ): Promise<T> {
        const route = this.routes[routeName];
        const uri = this.endpointPrefix + buildPath(route, reqOptions) + buildQueryString(reqOptions.queryParams);
        return this.requestHandler.uploadFormRequest(route.successStatus, route.verb, uri, {}, attachments, onProgress, onEnd);
    }

    protected handleForwardedUpload<T>(
        routeName: string,
        reqOptions: ClientRequestOptions,
        requestStream: unknown,
        requestHeaders: Record<string, string>
    ): Promise<T> {
        const route = this.routes[routeName];
        const uri = this.endpointPrefix + buildPath(route, reqOptions) + buildQueryString(reqOptions.queryParams);
        return this.requestHandler.forwardUploadRequest(route.successStatus, route.verb, uri, requestStream, requestHeaders);
    }

    protected handleWsConnect(): Promise<WebSocket> {
        const uri = `${this.endpointPrefix}/connect`;
        return this.requestHandler.handleWsConnect(uri);
    }

    public statusHealth(): Promise<string> {
        return this.handleRequest("statusHealth", {});
    }

    public statusBandwidth(sampleSize: number): Promise<string> {
        return this.handleRequest("statusBandwidth", {
            body: {
                sampleSize
            }
        });
    }

    public async bandWidthReport(sampleSize: number): Promise<IBandwidthReport> {
        const start = new Date();
        const data = await this.statusBandwidth(sampleSize);
        const stop = new Date();
        const receivedSampleSize = data.length;
        const elapsed = stop.getTime() - start.getTime();
        const mbytes = receivedSampleSize / elapsed / 1000;
        return {
            start,
            stop,
            sampleSize: receivedSampleSize,
            elapsed,
            mbits: mbytes * 8,
            mbytes
        }
    }

    public statusEcho(toEcho = ""): Promise<IEchoResponse> {
        return this.handleRequest<IEchoResponse>("statusEcho", {
            body: {
                toEcho
            }
        });
    }

    public statusEchoPost(toEcho = ""): Promise<IEchoResponse> {
        return this.handleRequest<IEchoResponse>("statusEchoPost", {
            body: {
                toEcho
            }
        });
    }

    public statusBuildInfo(): Promise<IBuildInfo> {
        return this.handleRequest<IBuildInfo>("statusBuildInfo", {});
    }
}

export interface IBuildInfo {
    branch: string;
    commit: string;
}

export interface IBandwidthReport {
    start: Date;
    stop: Date;
    sampleSize: number;
    elapsed: number;
    mbits: number;
    mbytes: number;
}

export interface IEchoResponse {
    headers: { [name: string]: string };
    cookies: { [name: string]: string };
    echo: string;
}

export interface ElasticSearchResultOptions {
    maxResults: number;
    orderBy?: string;
    ascending?: boolean;
    /**
     * By default, ES does not count all the hits for a query (but returns a generic 10k or so)
     * and to work around it we need to set an additional query param. Use it sparingly since it
     * comes with performance implications
     */
    resolveTotalHitsValue?: boolean;
}

// This URL query params starting with this prefix are reserved for
// marketing efforts. Our code should not use them.
const RESERVED_QUERY_PARAM_PREFIX = "m_";

export function filterQueryParams(params?: QueryParams): QueryParams | undefined {
    if(!params) {
        return undefined;
    }
    const filtered = {};
    for (const param of Object.keys(params)) {
        if (param.startsWith(RESERVED_QUERY_PARAM_PREFIX)) {
            // eslint-disable-next-line no-console
            console.error(`Filtering out an invalid query param: ${param}`);
            continue;
        }
        filtered[param] = params[param];
    }
    return filtered;
}