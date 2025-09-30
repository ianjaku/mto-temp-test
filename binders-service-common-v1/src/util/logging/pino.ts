import { AbstractLogger, LogLevel, LoggedData } from "./base";
import { LoggerConfig } from "./config";
import pino from "pino";

function mapLoglevel(level: LogLevel): pino.Level {
    switch (level) {
        case(LogLevel.TRACE): return "trace";
        case(LogLevel.DEBUG): return "debug";
        case(LogLevel.INFO): return "info";
        case(LogLevel.WARN): return "warn";
        case(LogLevel.ERROR): return "error";
        case(LogLevel.FATAL): return "fatal";
        default: throw new Error(`Unknown level ${level}`);
    }
}

export class PinoLogger extends AbstractLogger {
    private readonly baseOptions: { name: string; level: pino.Level };
    private pinoLogger: pino.Logger;
    private logMethods: Record<LogLevel, pino.LogFn>;
    private extraFields: Record<string, string>;

    constructor(loggerConfig: LoggerConfig, extraFields: Record<string, string> = {}) {
        super(loggerConfig, extraFields["requestedBy"], extraFields["correlationKey"]);
        this.baseOptions = {
            name: loggerConfig.name,
            level: mapLoglevel(this.minimalLogLevel),
        };
        this.extraFields = extraFields;
        this.updateLogger();
    }

    log(level: LogLevel, message: string, category: string, data?: LoggedData): void {
        this.logMethods[level]({ category, data }, message);
    }

    setExtraFields(fields: Record<string, string>): void {
        this.extraFields = { ...this.extraFields, ...fields };
        this.updateLogger();
    }

    private updateLogger(): void {
        this.pinoLogger = pino({ ...this.baseOptions, mixin: () => this.extraFields });
        this.setLogMethods();
    }

    private setLogMethods(): void {
        this.logMethods = {
            [LogLevel.TRACE]: this.pinoLogger.trace.bind(this.pinoLogger),
            [LogLevel.DEBUG]: this.pinoLogger.debug.bind(this.pinoLogger),
            [LogLevel.INFO]: this.pinoLogger.info.bind(this.pinoLogger),
            [LogLevel.WARN]: this.pinoLogger.warn.bind(this.pinoLogger),
            [LogLevel.ERROR]: this.pinoLogger.error.bind(this.pinoLogger),
            [LogLevel.FATAL]: this.pinoLogger.fatal.bind(this.pinoLogger),
        };
    }
}
