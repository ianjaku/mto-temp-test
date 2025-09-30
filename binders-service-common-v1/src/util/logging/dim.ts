import { AbstractLogger, LogLevel, LoggedData } from "./base";
import { LoggerConfig, LoggerConfigBuilder } from "./config";
import { Config } from "@binders/client/lib/config/config";
import chalk from "chalk";

const { bold, gray, red, yellow } = chalk;

export class DimConsoleLogger extends AbstractLogger {

    constructor(loggerConfig: LoggerConfig) {
        super(loggerConfig);
    }

    static fromConfig(config: Config, name?: string): DimConsoleLogger {
        return new DimConsoleLogger(LoggerConfigBuilder.fromConfig(config, name));
    }

    log(level: LogLevel, message: string, category: string, data?: LoggedData): void {
        const msg = JSON.stringify({ message, category, data });

        /* eslint-disable no-console */
        switch (level) {
            case LogLevel.TRACE:
            case LogLevel.DEBUG:
            case LogLevel.INFO:
                console.log(gray(msg));
                break;
            case LogLevel.WARN:
                console.log(yellow(msg));
                break;
            case LogLevel.ERROR:
                console.error(red(msg));
                break;
            case LogLevel.FATAL:
                console.error(red(bold(msg)));
                break;
        }
        /* eslint-enable no-console */
    }

    setExtraFields(): void {}
}
