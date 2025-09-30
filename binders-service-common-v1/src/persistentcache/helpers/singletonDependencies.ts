import { Config } from "@binders/client/lib/config/config";
import LaunchDarklyService from "../../launchdarkly/server";
import { LoggerBuilder } from "../../util/logging";

let _launchDarklyService: LaunchDarklyService | null = null;
export const getOrCreateLaunchDarklyService = async (config: Config): Promise<LaunchDarklyService> => {
    const logger = LoggerBuilder.fromConfig(config);
    if (_launchDarklyService == null) {
        _launchDarklyService = await LaunchDarklyService.create(config, logger);
    }
    return _launchDarklyService;
}
