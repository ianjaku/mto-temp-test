import { LDFlags } from "@binders/client/lib/launchdarkly";
import { useLaunchDarklyFlagsStoreActions } from "./ld-flags-store";

export const useLaunchDarklyFlagValue = <T>(flag: LDFlags): T => {
    const { getLaunchDarklyFlags } = useLaunchDarklyFlagsStoreActions();
    return getLaunchDarklyFlags()[flag] as T;
}
