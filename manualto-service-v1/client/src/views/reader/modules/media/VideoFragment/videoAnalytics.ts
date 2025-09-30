import { LDFlags } from "@binders/client/lib/launchdarkly";
import {
    LaunchDarklyFlagsStoreGetters
} from "@binders/ui-kit/lib/thirdparty/launchdarkly/ld-flags-store";
import Player from "video.js/dist/types/player";
import { VideojsAdapter } from "bitmovin-analytics";
import { getBindersConfig } from "@binders/client/lib/clients/config";

export const createAnalyticsReporterForVideoJsPlayer = (player: Player, videoId: string): void => {
    if (player == null || videoId == null) return;
    if (!shouldUseBitmovinAnalytics()) return;
    const analyticsKey = getBitmovinAnalyticsKey();
    if (analyticsKey == null) return;
    try {
        new VideojsAdapter({ key: analyticsKey, videoId }, player);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Failed to add the Bitmovin Analytics integration", e);
    }
};

// We treat a missing value as a "true" so we won't stop
// analytics reporting in case of a Launch Darkly outage
const shouldUseBitmovinAnalytics = () => LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.BITMOVIN_ANALYTICS] ?? true;

const getBitmovinAnalyticsKey = () => getBindersConfig().bitmovin?.analyticsKey;
