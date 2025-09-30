import * as apm from "elastic-apm-node";
import { WebRequest } from "../middleware/request";
import { getClientIps } from "../util/ip";


apm.start({
    captureBody: "all",
    transactionMaxSpans: 2000,
    logLevel: "info"
});

apm.addFilter((payload) => {
    if (payload?.context?.request?.body) {
        payload.context.request.body = filterOutSensitiveData(payload.context.request.body)
    }
    if (payload?.context?.custom?.body) {
        payload.context.custom.body = filterOutSensitiveData(payload.context.custom.body)
    }
    return payload;
});

const FIELDS_WITH_USER_SENSITIVE_DATA = ["password", "newPassword", "token", "userToken"];
const REDACTED = "[REDACTED]";

function filterOutSensitiveData(jsonString: string): string {
    try {
        if (!FIELDS_WITH_USER_SENSITIVE_DATA.some(field => jsonString.includes(`"${field}"`))) {
            return jsonString;
        }
        const parsedBody = JSON.parse(jsonString);
        for (const field of FIELDS_WITH_USER_SENSITIVE_DATA) {
            if (parsedBody[field]) {
                parsedBody[field] = REDACTED;
            }
        }
        return JSON.stringify(parsedBody);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to filter out sensitive data", e);
        return jsonString;
    }
}

export function getCurrentTraceId(): string | null {
    return apm.currentTraceIds["trace.id"];
}

export function addK8sToApm() {
    return (_: unknown, __: unknown, next: () => void): void => {
        const customContext: apm.Labels = {
            K8S_NODE: process.env.K8S_NODE,
            K8S_POD: process.env.K8S_POD,
        };
        apm.addLabels(customContext);
        next();
    }
}


const extractErrorParamsFromRequest = (request: WebRequest, metadata: Record<string, unknown>): apm.CaptureErrorOptions => ({
    request,
    custom: {
        ips: getClientIps(request),
        path: request.path,
        body: JSON.stringify(request.body),
        ...metadata
    }
});

export const logUncaughtError = (error: string | Error, request: WebRequest, metadata: Record<string, unknown> = {}): void => {
    if (request.loggedFatalError) {
        return;
    }
    try {
        const params = extractErrorParamsFromRequest(request, metadata);
        apm.captureError(error, params);
        request.loggedFatalError = true;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to send error to APM: ", e);
    }
}

export default apm;