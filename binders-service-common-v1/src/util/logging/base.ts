import { LoggerConfig } from "./config";
import { incrementFatalErrorLogCounter } from "../../monitoring/prometheus/fatalErrorMetric";

// eslint-disable-next-line @typescript-eslint/ban-types
export type LoggedData = Object;

export enum LogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO  = 2,
    WARN  = 3,
    ERROR = 4,
    FATAL = 5
}

type LoggedException = string | (Error & { test?: string });

export interface Logger {
    trace(message: string, category: string, data?: LoggedData): void;
    debug(message: string, category: string, data?: LoggedData): void;
    info(message: string, category: string, data?: LoggedData): void;
    warn(message: string, category: string, data?: LoggedData): void;
    error(message: string, category: string, data?: LoggedData): void;
    fatal(message: string, category: string, data?: LoggedData): void;
    setExtraFields(fields: Record<string, string>): void;
    logException(ex: LoggedException, category: string): void;
    readonly correlationKey: string | undefined;
}

export abstract class AbstractLogger implements Logger {

    public readonly correlationKey: string | undefined;
    protected minimalLogLevel: LogLevel;

    abstract log(level: LogLevel, message: string, category: string, data?: LoggedData): void;
    abstract setExtraFields(fields: Record<string, string>): void;

    protected constructor(loggerConfig: LoggerConfig, userId?: string, correlationKey?: string) {
        this.correlationKey = correlationKey;
        this.minimalLogLevel = loggerConfig.minimalLogLevel;
    }

    private maybeLog(level: LogLevel, message: string, category: string, data: LoggedData | undefined): void {
        if (this.minimalLogLevel <= level) {
            this.log(level, message, category, data);
        }
    }

    trace(message: string, category: string, data?: LoggedData): void {
        this.maybeLog(LogLevel.TRACE, message, category, data);
    }

    debug(message: string, category: string, data?: LoggedData): void {
        this.maybeLog(LogLevel.DEBUG, message, category, data);
    }

    info(message: string, category: string, data?: LoggedData): void {
        this.maybeLog(LogLevel.INFO, message, category, data);
    }

    warn(message: string, category: string, data?: LoggedData): void {
        this.maybeLog(LogLevel.WARN, message, category, data);
    }

    error(message: string, category: string, data?: LoggedData): void {
        this.maybeLog(LogLevel.ERROR, message, category, data);
    }

    fatal(message: string, category: string, data?: Record<string, unknown>): void {
        incrementFatalErrorLogCounter()
        this.maybeLog(LogLevel.FATAL, message, category, data);
    }

    logException(ex: LoggedException, category: string): void {
        switch (typeof ex) {
            case "object": {
                const message = ex.message || ex.test || ex.toString();
                let data = undefined;
                if ("toJSON" in ex) {
                    try {
                        data = JSON.parse(JSON.stringify(ex));
                    } catch {
                        data = { error: "Unserializable" };
                    }
                }
                this.error(message, category, data);
                break;
            }
            default: {
                try {
                    this.error(ex, category);
                } catch (logError) {
                    // eslint-disable-next-line no-console
                    console.error("Original error", ex);
                    // eslint-disable-next-line no-console
                    console.error("Logging error", logError);
                }
                break;
            }
        }
    }
}
