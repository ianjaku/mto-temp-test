export const LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP = "launchDarklyOverriddenFlags";

/**
 * Single source of truth for all LaunchDarkly flags
 */
export enum LDFlags {
    ACCOUNT_ADMINS_CAN_GENERATE_ACCOUNT_REPORTS = "AccountAdminsCanGenerateAccountReports",
    AI_CONTENT_OPTIMIZATION = "ai-content-optimization",
    AUTHORIZATION_CACHE_MODE = "authorization-cache-mode",
    ELASTIC_COMPATIBILITY_MODE = "elastic-compatibility-mode",
    ENABLE_PUBLICATION_LOG_OPERATIONS = "enable-log-operation-queue",
    BITMOVIN_ANALYTICS = "bitmovin-analytics",
    POSTHOG_KEY = "posthog-key",
    DEVICE_USER_GROUP_INTERSECTION = "device-user-group-intersection",
    SCROLL_HINT_CONFIGURATION = "scroll-hint-configuration",
    TIPTAP_NICHE_EDITING_OPTIONS = "tiptap-niche-editing-options",
    MANUAL_FROM_VIDEO = "manual-from-video",
    PUBLIC_API_RATE_LIMIT_VALUE = "public-api-rate-limit-value",
    ONE_TAKE_MANUAL_FROM_CORP_SITE_ALLOWED_COLLECTION_IDS = "one-take-manual-from-corp-site-allowed-collection-i-ds",
    VIDEO_TRIMMING = "video-trimming",
    OBFUSCATED_READING_TIME_CONFIGURATION = "obfuscated-reading-time",

    // -- Release flags --
    // Release flags are temporary flags that are used to slowly roll out a new feature and will be removed once the feature is fully rolled out

    HOME_PAGE = "home-page",
    READER_SHARE_MODAL = "reader-share-modal",
    READER_SHARE_MT_DOCUMENTS = "reader-share-mt-documents",
    USE_TIP_TAP = "use-tip-tap",
    USE_HUBSPOT_CHATWIDGET = "use-hubspot-chatwidget",
    DOMAIN_REDIRECT_CONFIGS = "domain-redirect-configs",
    SUBCOLLECTION_ANALYTICS = "subcollection-analytics",
    SCREENSHOT_WORKER = "screenshot-worker"
}
