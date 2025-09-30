import { Config } from "@binders/client/lib/config/config"
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { getOrCreateLaunchDarklyService } from "../persistentcache/helpers/singletonDependencies"

export type ElasticCompatibilityMode = "6" | "7"


export async function isValidElasticMode(config: Config, version: ElasticCompatibilityMode): Promise<boolean> {
    if (process.env.BINDERS_ENV === "development") {
        return process.env.ELASTIC_COMPABILITY_MODE === version;
    }
    const ldService = await getOrCreateLaunchDarklyService(config);
    const flagValue = await ldService.getFlag<ElasticCompatibilityMode>(LDFlags.ELASTIC_COMPATIBILITY_MODE);
    return flagValue === version;
}

export async function getElasticCompatibilityMode(config: Config): Promise<ElasticCompatibilityMode> {
    if (process.env.BINDERS_ENV === "development") {
        return process.env.ELASTIC_COMPABILITY_MODE as ElasticCompatibilityMode;
    }
    const ldService = await getOrCreateLaunchDarklyService(config);
    return await ldService.getFlag<ElasticCompatibilityMode>(LDFlags.ELASTIC_COMPATIBILITY_MODE);
}
