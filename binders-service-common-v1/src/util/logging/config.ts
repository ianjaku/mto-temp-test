import { Config, ConfigError } from "@binders/client/lib/config/config";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import { LogLevel } from "./base";

class LogLevels {
    static fromString(candidate: string): LogLevel {
        switch (candidate.toUpperCase()) {
            case "TRACE": return LogLevel.TRACE;
            case "DEBUG": return LogLevel.DEBUG;
            case "INFO": return LogLevel.INFO;
            case "WARN": return LogLevel.WARN;
            case "ERROR": return LogLevel.ERROR;
            case "FATAL": return LogLevel.FATAL;
        }
        throw new InvalidArgument(`"${candidate} is not a valid log level"`);
    }
}

interface BindersLogConfig {
    level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
}

export interface LoggerConfig {
    name: string;
    minimalLogLevel: LogLevel;
}

/**
 * Example config:
 * <code>
 *     {
 *         logging: {
 *             default: {
 *                 level: "INFO" // required
 *             }
 *             myservice: {
 *                 level: "DEBUG"
 *             }
 *         }
 *     }
 * </code>
 */
export class LoggerConfigBuilder {
    static fromConfig(config: Config, serviceName?: string): LoggerConfig {
        const defaultConfigKey = getLoggingConfigKey("default");
        const defaultConfig = config.getObject<BindersLogConfig>(defaultConfigKey).getOrElse(undefined);

        if (serviceName)  {
            const serviceConfigKey = getLoggingConfigKey(serviceName);
            const serviceConfig = config.getObject<BindersLogConfig>(serviceConfigKey).getOrElse(undefined);
            const mergedConfig = { ...(defaultConfig ?? {}), ...(serviceConfig ?? {}) };
            return assertConfigOption(serviceName, mergedConfig);
        } else {
            return assertConfigOption("default", defaultConfig);
        }
    }
}

function getLoggingConfigKey(component: string): string {
    return "logging." + component;
}

function assertConfigOption(serviceName: string, config: Partial<BindersLogConfig> | undefined): LoggerConfig {
    if (!config) {
        throw new ConfigError("Could not find logger config.");
    }
    if (!config.level) {
        throw new ConfigError(`"Could not find required log level for service ${serviceName}"`);
    }
    return {
        name: serviceName,
        minimalLogLevel: LogLevels.fromString(config.level),
    };
}
