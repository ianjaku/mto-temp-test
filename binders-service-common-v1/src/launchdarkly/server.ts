import * as LaunchDarkly from "launchdarkly-node-server-sdk";
import { RedisClient, RedisClientBuilder } from "../redis/client";
import { Config } from "@binders/client/lib/config/config";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { Logger } from "../util/logging";

type FlagContext = { userId?: string; accountId?: string };

export interface IFeatureFlagService {
    getFlag<T>(flagKey: LDFlags, context?: FlagContext): Promise<T>;
    getAllFlags(context?: FlagContext): Promise<LaunchDarkly.LDFlagSet>;
}
export const LD_FLAGS_KEY = "ld-flags"

type LaunchDarklyConfig = { clientSideId: string; sdkKey: string }

const LAUNCH_DARKLY_LOG_CATEGORY = "launch-darkly"
class LaunchDarklyService implements IFeatureFlagService {
    static async create(config: Config, logger: Logger): Promise<LaunchDarklyService> {
        const maybeLdConfig = config.getObject("launchDarkly")
        const redisClient = RedisClientBuilder.fromConfig(config, "persistent-cache")

        if (maybeLdConfig.isNothing()) {
            throw new Error("Missing Launch Darkly config")
        }
        const ldConfig = maybeLdConfig.get() as LaunchDarklyConfig;
        const ldClient = await LaunchDarkly.init(ldConfig.sdkKey);
        try {
            await ldClient.waitForInitialization();
        } catch (error) {
            logger.error(`Failed to initialize LaunchDarkly client ${error}`, LAUNCH_DARKLY_LOG_CATEGORY)
        }
        return new LaunchDarklyService(ldClient, logger, redisClient);
    }

    async getFlag<T>(flagKey: LDFlags, context?: FlagContext): Promise<T> {
        try {
            const ldContext: LaunchDarkly.LDContext = {
                kind: "multi",
                user: { key: context?.userId ?? "default" },
                account: { key: context?.accountId ?? "default" }
            };
            return await this.ldClient.variation(flagKey, ldContext, undefined) as T;
        } catch (error) {
            return this.fallbackToRedis(flagKey);
        }
    }

    updateContext(context: LaunchDarkly.LDContext): void {
        this.ldClient.identify(context);
    }

    async flushEvents(): Promise<void> {
        await this.ldClient.flush();
    }

    async getAllFlags(context?: FlagContext): Promise<LaunchDarkly.LDFlagSet> {
        try {
            const ldContext: LaunchDarkly.LDContext = {
                kind: "multi",
                user: { key: context?.userId ?? "default" },
                account: { key: context?.accountId ?? "default" }
            };
            const allFlags = await this.ldClient.allFlagsState(ldContext);
            return allFlags.allValues();
        } catch (error) {
            this.logger.warn(`Failed to fetch flags from LaunchDarkly. Reason: ${error.message}`, "ld-service");
            return this.fallbackToRedis()
        }
    }

    private async fallbackToRedis(flagKey?: string) {
        const flags = await this.redisClient.get(LD_FLAGS_KEY);
        this.logger.info(`Cached LD Flags: ${flags}`, "ld-service");
        const parsedFlags = JSON.parse(flags) as LaunchDarkly.LDFlagSet
        return flagKey ? parsedFlags[flagKey] : parsedFlags
    }

    private constructor(
        private readonly ldClient: LaunchDarkly.LDClient,
        private readonly logger: Logger,
        private readonly redisClient: RedisClient
    ) { }
}


export default LaunchDarklyService;
