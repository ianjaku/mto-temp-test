import * as HTTPStatusCode from "http-status-codes";
import { ValidationRule, fromBody, validatePositiveInt } from "./validation";

export class HTTPVerb {
    static GET = "GET";
    static PUT = "PUT";
    static POST = "POST";
    static DELETE = "DELETE";
    static OPTIONS = "OPTIONS";
    static HEAD = "HEAD";
    static PATCH = "PATCH";
}

export type ErrorHandler = (err, req, res, next) => void;

export interface AppRoute {
    description: string;
    verb: string;
    path: string;
    validationRules: ValidationRule[];
    successStatus: number;
    webSocket?: boolean;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function validateRule(req, rule: ValidationRule): string[] {
    const [extractor, key, validator, requiredness] = rule;
    const container = extractor(req);
    if (key in container) {
        return validator(container[key]);
    }
    if (requiredness === "optional") {
        return [];
    }
    return [`Missing value for parameter ${key}`];
}

export const SHARED_ROUTES: {[name: string]: AppRoute} = {
    statusHealth: {
        description: "Basic health check",
        verb: HTTPVerb.GET,
        path: "/_status/healtz",
        validationRules: [],
        successStatus: HTTPStatusCode.OK
    },
    statusBandwidth: {
        description: "Send back data to perform a bandwidth check",
        verb: HTTPVerb.GET,
        path: "/_status/bandwidth",
        validationRules: [
            [fromBody, "sampleSize", validatePositiveInt]
        ],
        successStatus: HTTPStatusCode.OK
    },
    statusBuildInfo: {
        description: "Get the current build info",
        verb: HTTPVerb.GET,
        path: "/_status/buildinfo",
        validationRules: [],
        successStatus: HTTPStatusCode.OK
    },
    statusEcho: {
        description: "Echo back the data sent with some server variables",
        verb: HTTPVerb.GET,
        path: "/_status/echo",
        validationRules: [],
        successStatus: HTTPStatusCode.OK
    },
    statusEchoPost: {
        description: "Echo back the data sent with some server variables",
        verb: HTTPVerb.POST,
        path: "/_status/echo",
        validationRules: [],
        successStatus: HTTPStatusCode.OK
    },
    statusMetrics: {
        description: "Export Prometheus metrics",
        verb: HTTPVerb.GET,
        path: "/_status/metrics",
        validationRules: [],
        successStatus: HTTPStatusCode.OK
    },
    statusMemwatch: {
        description: "Search for memory leaks",
        verb: HTTPVerb.GET,
        path: "/_status/memwatch",
        validationRules: [],
        successStatus: HTTPStatusCode.OK
    },
    statusWhoAmI: {
        description: "Identify the requesting user",
        verb: HTTPVerb.GET,
        path: "/_status/whoAmI",
        validationRules: [],
        successStatus: HTTPStatusCode.OK
    }
}