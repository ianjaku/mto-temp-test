import { LoggerConfig, LoggerConfigBuilder } from "./config";
import { Config } from "@binders/client/lib/config";
import { CorrelationKey } from "./correlationKey";
import { Logger } from "./base";
import { PinoLogger } from "./pino";
import { WebRequest } from "../../middleware/request";
import { getClientIpsAsString } from "../ip";

export class LoggerBuilder {
    static fromConfig(config: Config, name?: string, extraFields: Record<string, string> = {}): Logger {
        const loggerConfig = LoggerConfigBuilder.fromConfig(config, name);
        return new PinoLogger(loggerConfig, extraFields);
    }

    static async forExpressRequest(loggerConfig: LoggerConfig, req: WebRequest): Promise<Logger> {
        const apm = await import("../../monitoring/apm");
        const traceId = apm.getCurrentTraceId();
        const extraFields = {
            requestedBy: req.user == null ? undefined : req.user.userId,
            correlationKey: CorrelationKey.fromExpressRequestHeader(req).value(),
            forwardedFor: getClientIpsAsString(req),
            forwardedForHost: req.proxyConfig?.proxyDomain,
            domain: req.header("host"),
            ...(traceId ? { traceId } : {}),
        };
        return new PinoLogger(loggerConfig, extraFields);
    }
}
