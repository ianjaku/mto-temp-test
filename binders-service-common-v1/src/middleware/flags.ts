import { LDFlags } from "@binders/client/lib/launchdarkly";
import LaunchDarklyService from "../launchdarkly/server";
import { Logger } from "../util/logging";
import { ResourceNotFound } from "@binders/client/lib/clients/model";

export const requireLaunchDarklyFlagEnabled = async (launchDarklyService: LaunchDarklyService, flagName: LDFlags, logger?: Logger): Promise<void> => {
    const flagValue = await launchDarklyService.getFlag<boolean>(flagName);
    if (!flagValue) {
        logger?.warn(`${flagName} is disabled`, "ld-feature-check")
        throw new ResourceNotFound();
    }
};