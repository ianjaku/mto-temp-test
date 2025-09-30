import * as fs from "fs";
import { Logger, LoggerBuilder } from "../util/logging";
import { getBindersEnv, isProduction, isStaging } from "@binders/client/lib/util/environment";
import { ConfigError } from "@binders/client/lib/config/config";
import { JSONConfig } from "./config";
import { Maybe } from "@binders/client/lib/monad";

export class BindersConfig extends JSONConfig {
    static PRODUCTION_CONFIG_PATH = "/etc/binders/production.json";
    static STAGING_CONFIG_PATH = "/etc/binders/staging.json";
    private loggerOption: Maybe<Logger>;
    private static lastUsingConfigPrint: string = null;

    // eslint-disable-next-line @typescript-eslint/ban-types
    constructor(data: Object, filePath: string, reloadIntervalInSeconds?: number, md5Hash?: string) {
        super(data, filePath, reloadIntervalInSeconds, md5Hash);
        this.loggerOption = Maybe.nothing<Logger>();
    }

    protected logInfo(message: string): void {
        if (this.loggerOption.isJust()) {
            this.loggerOption.get().info(message, "config");
        } else {
            super.logInfo(message);
        }
    }

    protected logError(message: string): void {
        if (this.loggerOption.isJust()) {
            this.loggerOption.get().error(message, "config");
        } else {
            super.logError(message);
        }
    }

    updateLogger(logger: Logger): void {
        this.loggerOption = Maybe.just(logger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static create(jsonFilePath: string, reloadIntervalInSeconds?: number) {
        const { contents, md5Hash } = JSONConfig.getJsonFromFile(jsonFilePath);
        const config = new BindersConfig(contents, jsonFilePath, reloadIntervalInSeconds, md5Hash);
        const logger = LoggerBuilder.fromConfig(config, "config");
        config.updateLogger(logger);
        return config;
    }

    static get(reloadIntervalInSeconds?: number): BindersConfig {
        if (isProduction()) {
            return BindersConfig.create(BindersConfig.PRODUCTION_CONFIG_PATH, reloadIntervalInSeconds);
        }
        if (isStaging()) {
            return BindersConfig.create(BindersConfig.STAGING_CONFIG_PATH, reloadIntervalInSeconds);
        }
        const bindersEnv = getBindersEnv();
        if (bindersEnv) {
            return BindersConfig.create(`/etc/binders/${bindersEnv}.json`, reloadIntervalInSeconds);
        }
        return BindersConfig.create(BindersConfig.findDevelopmentJson(process.cwd()), reloadIntervalInSeconds);
    }

    private static findDevelopmentJson(directory: string) {
        const fileCandidate = directory + "/config/development.json";
        if (fs.existsSync(fileCandidate)) {
            if (this.lastUsingConfigPrint !== fileCandidate) {
                // eslint-disable-next-line no-console
                console.log("Using config: " + fileCandidate);
                this.lastUsingConfigPrint = fileCandidate;
            }
            return fileCandidate;
        }
        if (directory === "/") {
            const finalShot = "/etc/binders/development.json";
            if (fs.existsSync(finalShot)) {
                return finalShot;
            }
            throw new ConfigError("Could not find development configuration.");
        }
        const newCandidateDirectory = fs.realpathSync(directory + "/..");
        if (newCandidateDirectory === directory) {
            throw new ConfigError("Could not find development configuration.");
        }
        return BindersConfig.findDevelopmentJson(newCandidateDirectory);
    }
}
