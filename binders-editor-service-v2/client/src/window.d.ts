import type { IBindersConfig } from "@binders/client/lib/clients/config";
import type { IBuildInfo } from "@binders/client/lib/clients/client";

declare global {
    interface Window {
        buildInfo?: IBuildInfo; // Not avaliable on develop
        launchDarklyFlags: Record<string, unknown>;
        bindersConfig: IBindersConfig
    }
}