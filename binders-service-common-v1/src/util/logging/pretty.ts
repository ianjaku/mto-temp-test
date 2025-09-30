import { AbstractLogger, LogLevel } from "./base";
import { LoggerConfig, LoggerConfigBuilder } from "./config";
import { Config } from "@binders/client/lib/config/config";
import chalk from "chalk";
import { humanizeDuration } from "@binders/client/lib/util/formatting";

const { bgBlue, bgRed, bgWhite, bgYellow, black, bold, gray, red, yellow } = chalk;

export class PrettyConsoleLogger extends AbstractLogger {

    private readonly name: string;
    private bornAt: number;

    constructor(loggerConfig: LoggerConfig) {
        super(loggerConfig);
        this.name = loggerConfig.name;
        this.bornAt = new Date().getTime();
    }

    static fromConfig(config: Config, name?: string): PrettyConsoleLogger {
        return new PrettyConsoleLogger(LoggerConfigBuilder.fromConfig(config, name));
    }

    log(level: LogLevel, msg: string, _category: string, _data: unknown): void {
        const tag = gray(`[${this.name}]`);
        const duration = gray(humanizeDuration(new Date().getTime() - this.bornAt).padStart(8, " "));

        /* eslint-disable no-console */
        switch (level) {
            case LogLevel.TRACE:
                console.log(tag, duration, " TRACE ", gray(msg));
                break;
            case LogLevel.DEBUG:
                console.log(tag, duration, bgWhite(black(" DEBUG ")), msg);
                break;
            case LogLevel.INFO:
                console.info(tag, duration, bgBlue(black(" INFO  ")), bold(msg))
                break;
            case LogLevel.WARN:
                console.info(tag, duration, bgYellow(black(" WARN  ")), yellow(msg))
                break;
            case LogLevel.ERROR:
                console.info(tag, duration, bgRed(black(" ERROR ")), red(msg))
                break;
            case LogLevel.FATAL:
                console.info(tag, duration, bold(bgRed(black(" FATAL "))), bold(red(msg)))
                break;
        }
        /* eslint-enable no-console */
    }

    setExtraFields(): void {}
}
