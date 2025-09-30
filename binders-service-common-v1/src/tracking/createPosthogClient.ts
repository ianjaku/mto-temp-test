import { BindersConfig } from "../bindersconfig/binders";
import { LoggerBuilder } from "../util/logging";
import { PostHog } from "posthog-node";


const logError = (message: string, context: Record<string, unknown>) => {
    try {
        const config = BindersConfig.get();
        const logger = LoggerBuilder.fromConfig(config, "posthog");
        logger?.warn(message, "createPosthogClient", context);
    } catch (e) {
        // Ignore
    }
}

function getPosthogKey() {
    const config = BindersConfig.get();
    if (config == null) return null;
    return config.getString("posthog.publicKey").get()
}

export const createPosthogClient = async (): Promise<PostHog | null> => {
    try {
        const posthogKey = await getPosthogKey();
        if (!posthogKey) return null;
        return new PostHog(
            posthogKey,
            { host: "https://eu.i.posthog.com" }
        );
    } catch (error) {
        logError("Error creating PostHog client", { error });
        return null;
    }
}
