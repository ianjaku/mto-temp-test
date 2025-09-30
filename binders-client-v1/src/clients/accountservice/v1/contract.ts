import { IThumbnail, MTEngineType } from "../../repositoryservice/v3/contract";
import { EntityNotFound } from "../../model";
import { LDFlags } from "binders-client-v1/src/launchdarkly";
import { TranslationKeys } from "../../../i18n/translations";
import { defaultLanguage } from "../../../i18n";
import i18next from "../../../i18n";

export class AccountNotFound extends EntityNotFound {
    constructor(id: string) {
        super(i18next.t(TranslationKeys.Account_NoAccountWithId, { id }));
        Object.setPrototypeOf(this, AccountNotFound.prototype);  // ES5 >= requirement
    }
}

export class CustomerNotFound extends EntityNotFound {
    constructor(id: string) {
        super(`Could not find customer with id: ${id}`);
    }
}

export class MSTransactableSubscriptionNotFound extends EntityNotFound {
    constructor(
        msSubscriptionId: string, identifier: "subscriptionId" | "accountId" = "subscriptionId"
    ) {
        super(`Subscription through microsoft not foud with ${identifier} token: ${msSubscriptionId}`);
    }
}

export interface ICustomer {
    id: string;
    name: string;
    crmCustomerId?: string;
    accountIds: Array<string>;
    created: Date;
}

export interface Account {
    id: string;
    name: string;
    members: Array<string>;
    subscriptionType: string;
    subscriptionId: string;
    expirationDate: string;
    readerExpirationDate?: string;
    accountIsNotExpired: boolean;
    amIAdmin?: boolean;
    canIEdit?: boolean;
    canIAccessAnalytics?: boolean;
    canIAccessUsergroupsMgmt?: boolean;
    canIAccessImportUsersMgmt?: boolean;
    domains: string[];
    thumbnail?: IThumbnail;
    rootCollectionId?: string;
    maxNumberOfLicenses?: number;
    maxPublicCount?: number;
    created: Date;
    storageDetails?: IAccountStorageDetails;
    isAnonymised?: boolean;
    htmlHeadContent?: string;
}

export interface AccountSummary {
    id: string;
    isReaderExpired: boolean;
}

export interface AccountLicensing {
    accountId: string;
    totalPublicDocuments: number;
    maxPublicCount: number;
    totalLicenses: number;
    maxNumberOfLicenses: number;
}

export interface IAzureSSOSettings {
    tenantId: string;
}
export interface ISAMLSSOSettings {
    tenantId: string;
    enabled: boolean;
    certificateName: string;
    issuer: string;
    entryPoint: string;
    logout?: string;
    ssoButtonText?: string;
    enterpriseApplicationId?: string;
    enterpriseApplicationGroupReadSecret?: string;
    certificateExpirationDate?: Date;
    userGroupIdForUserManagement?: string;
    autoRedirect?: boolean;
    /** The SSO provider, missing means {@link SSOProvider.ENTRA_ID} */
    provider?: SSOProvider;
}

export enum SSOProvider {
    ENTRA_ID = "ENTRA_ID",
    OKTA = "OKTA",
}

export const resolveSSOProviderName = (provider: SSOProvider) =>
    provider === SSOProvider.OKTA ? "Okta" : "Microsoft Entra ID";

export interface ISSOAccountSettings {
    azure: IAzureSSOSettings;
    saml: ISAMLSSOSettings;
}

export interface IMTAccountSettings {
    generalOrder?: MTEngineType[],
    pairs?: { [languageCodesSerialized: string]: MTEngineType },
}

export interface IVisualsAccountSettings {
    fitBehaviour: string;
    bgColor?: string;
    audioEnabled?: boolean;
}
export interface ILanguageAccountSettings {
    defaultCode?: string;
    interfaceLanguage?: string;
}

export interface IPDFExportAccountSettings {
    renderOnlyFirstCarrouselItem: boolean;
}

export interface IPublicAccountSettings {
    visuals: IVisualsAccountSettings;
    languages: ILanguageAccountSettings;
    pdfExport: IPDFExportAccountSettings;
    thumbnail?: IThumbnail;
}

export enum AccountSortMethod {
    Alphabetical = "alphabetical",
    CollectionsFirst = "collections_first",
    None = "none",
    Numerical = "numerical"
}

export interface IAccountSortSettings {
    sortMethod: AccountSortMethod;
}

export interface SecuritySettings {
    autoLogout?: boolean;
    autoLogoutPeriodMinutes?: number;
}

export interface AG5Settings {
    apiKey: string;
}

export interface IAccountSettings extends IPublicAccountSettings {
    sso: ISSOAccountSettings;
    userTokenSecret?: string;
    mt: IMTAccountSettings;
    sorting: IAccountSortSettings;
    thumbnail?: IThumbnail;
    security?: SecuritySettings;
    htmlHeadContent?: string;
    ag5?: AG5Settings;
}

export interface IUpdateFeaturesOptions {
    doReplace?: boolean;
}

export interface IAccountStorageDetails {
    deletedVisualsSize?: number;
    dirty?: boolean;
    inUseVisualsSize?: number;
}

export const FEATURE_ACCOUNT_ANALYTICS = "account_analytics";
export const FEATURE_AD_SSO = "activeDirectory_sso";
export const FEATURE_AI_CONTENT_FORMATTING = "ai_content_formatting";
export const FEATURE_ALLOW_IFRAMES = "allow_iframes";
export const FEATURE_ANALYTICS = "analytics";
export const FEATURE_ANONYMOUS_RATING = "anonymous_rating";
export const FEATURE_APPROVAL_FLOW = "approval_flow";
export const FEATURE_AUTOLOGOUT = "autologout";
export const FEATURE_AUTOMATED_ITEM_SORTING = "automated_item_sorting";
export const FEATURE_BLOCK_CHECKLIST_PROGRESS = "block_checklist_progress";
export const FEATURE_BROWSER_LOGO_FAVICON = "browser_logo_favicon";
export const FEATURE_BROWSE_VIEW_TTS_SUPPORT = "browse_view_tts_support";
export const FEATURE_BROWSER_TAB_TITLE = "browser_tab_title";
export const FEATURE_CEVA = "ceva";
export const FEATURE_CHECKLISTS = "checklists";
export const FEATURE_COLLECTION_HIDE = "collection_hide";
export const FEATURE_COMMENTING_IN_EDITOR = "commenting_in_editor";
export const FEATURE_CONTRIBUTOR_ROLE = "contributor_role";
export const FEATURE_CUSTOM_NOTIFICATION_EMAIL_NAME = "custom_notification_email_name";
export const FEATURE_DEBUG_LOGGING = "debug_logging";
export const FEATURE_DEVICE_LOGIN_PASSWORD = "device_login_password";
export const FEATURE_DEVICE_USER_IMPERSONATION = "device_user_impersonation";
export const FEATURE_DIALECTS = "include_language_dialects";
export const FEATURE_DISABLE_CONCURRENT_LOGINS = "disable_concurrent_logins";
export const FEATURE_DISABLE_PRELOADING = "disable_preloading";
export const FEATURE_DISABLE_PUBLIC_ICON = "disable_public_icon";
export const FEATURE_DISABLE_SIGNUP = "disable_signup";
export const FEATURE_DOCUMENT_OWNER = "document_owner";
export const FEATURE_DOWNLOAD_PDF_FROM_READER = "download_pdf_from_reader";
export const FEATURE_DUPLICATE_ACLS = "duplicate_acls_along_with_content";
export const FEATURE_EMOJIS_IN_EDITOR = "emojis_in_editor";
export const FEATURE_FORCE_LOWRES_VIDEO = "force_lowres_video";
export const FEATURE_GROUP_OWNERS = "group_owners";
export const FEATURE_HISTORY_PANE = "publication_history_pane";
export const FEATURE_INTERFACE_I18N = "interface_i18n";
export const FEATURE_LEGACY_READER_LANDING_PAGE = "legacy_reader_landing_page"
export const FEATURE_LIVECHAT = "livechat";
export const FEATURE_LIVE_TRANSLATION_ON_READER = "live_translation_on_reader";
export const FEATURE_MANUALTO_CHUNK = "manualto_chunk";
export const FEATURE_MULTILINGUAL_MEDIA = "multilingual_media";
export const FEATURE_NOCDN = "disable_cdn";
export const FEATURE_NOTIFICATIONS = "notifications"
export const FEATURE_PDF_EXPORT = "export_publications_as_pdf";
export const FEATURE_PUBLICCONTENT = "public_content";
export const FEATURE_PUBLIC_API = "public_api";
export const FEATURE_QR_CODE_LOGO = "qr_code_logo";
export const FEATURE_READER_COMMENTING = "reader_commenting";
export const FEATURE_READER_RATING = "reader_rating";
export const FEATURE_READER_TITLE_CHUNK = "reader_title_chunk";
export const FEATURE_READONLY_EDITOR = "readonly_editor";
export const FEATURE_READ_REPORTS = "read_reports";
export const FEATURE_READ_SCOPES = "read_scopes";
export const FEATURE_RECURSIVE_ACTIONS = "recursive_actions";
export const FEATURE_REDIRECT_TO_EDITOR = "redirect_to_editor";
export const FEATURE_SEARCH_JUMP_TO_CHUNK = "search_jump_to_chunk";
export const FEATURE_TERMS_AND_CONDITIONS = "require_accept_terms_and_conditions"
export const FEATURE_TEXT_TO_SPEECH = "text_to_speech"
export const FEATURE_TRANSLATOR_ROLE = "translator_role";
export const FEATURE_USERGROUPS_IN_USERACTION_EXPORT = "usergroups_in_useraction_export";
export const FEATURE_USERTOKEN_LOGIN = "usertoken_login"
export const FEATURE_VIDEOINDEXING = "video_indexing"
export const FEATURE_VIDEOS_WITH_AUDIO = "videos_with_audio";
export const FEATURE_VIDEO_STREAMING = "video_streaming";
export const FEATURE_ADD_USERS_IN_EDITOR = "add_users_in_editor";
export const FEATURE_GHENTIAN_DIALECT = "include_ghentian_dialect";
export const FEATURE_MANUALTO_USER_MANAGEMENT_VIA_ENTRA_ID_GROUP = "manualto_user_management_via_entra_id_group";
export const FEATURE_READ_CONFIRMATION = "read_confirmation";
export const FEATURE_AG5 = "ag5";


// Streaming debugging features
export const FEATURE_STREAMING_DEBUG = "streaming_debug";
export const FEATURE_STREAMING_DISABLE_1080p = "streaming_disable_1080p";
export const FEATURE_STREAMING_DISABLE_540p = "streaming_disable_540p";
export const FEATURE_STREAMING_DISABLE_720p = "streaming_disable_720p";
export const FEATURE_STREAMING_START_360P = "streaming_start_360p";
export const FEATURE_STREAMING_START_540P = "streaming_start_540p";
export const FEATURE_STREAMING_START_720P = "streaming_start_720p";

export const FEATURES = [
    FEATURE_ACCOUNT_ANALYTICS,
    FEATURE_ADD_USERS_IN_EDITOR,
    FEATURE_AD_SSO,
    FEATURE_AI_CONTENT_FORMATTING,
    FEATURE_ALLOW_IFRAMES,
    FEATURE_ANALYTICS,
    FEATURE_ANONYMOUS_RATING,
    FEATURE_APPROVAL_FLOW,
    FEATURE_AUTOLOGOUT,
    FEATURE_AUTOMATED_ITEM_SORTING,
    FEATURE_BLOCK_CHECKLIST_PROGRESS,
    FEATURE_BROWSER_LOGO_FAVICON,
    FEATURE_BROWSER_TAB_TITLE,
    FEATURE_BROWSE_VIEW_TTS_SUPPORT,
    FEATURE_CEVA,
    FEATURE_CHECKLISTS,
    FEATURE_COLLECTION_HIDE,
    FEATURE_COMMENTING_IN_EDITOR,
    FEATURE_CONTRIBUTOR_ROLE,
    FEATURE_CUSTOM_NOTIFICATION_EMAIL_NAME,
    FEATURE_DEBUG_LOGGING,
    FEATURE_DEVICE_LOGIN_PASSWORD,
    FEATURE_DEVICE_USER_IMPERSONATION,
    FEATURE_DIALECTS,
    FEATURE_DISABLE_CONCURRENT_LOGINS,
    FEATURE_DISABLE_PRELOADING,
    FEATURE_DISABLE_PUBLIC_ICON,
    FEATURE_DISABLE_SIGNUP,
    FEATURE_DOCUMENT_OWNER,
    FEATURE_DOWNLOAD_PDF_FROM_READER,
    FEATURE_DUPLICATE_ACLS,
    FEATURE_EMOJIS_IN_EDITOR,
    FEATURE_FORCE_LOWRES_VIDEO,
    FEATURE_GROUP_OWNERS,
    FEATURE_HISTORY_PANE,
    FEATURE_INTERFACE_I18N,
    FEATURE_LEGACY_READER_LANDING_PAGE,
    FEATURE_LIVECHAT,
    FEATURE_LIVE_TRANSLATION_ON_READER,
    FEATURE_MANUALTO_CHUNK,
    FEATURE_MULTILINGUAL_MEDIA,
    FEATURE_NOCDN,
    FEATURE_NOTIFICATIONS,
    FEATURE_PDF_EXPORT,
    FEATURE_PUBLICCONTENT,
    FEATURE_PUBLIC_API,
    FEATURE_QR_CODE_LOGO,
    FEATURE_READER_COMMENTING,
    FEATURE_READER_RATING,
    FEATURE_READER_TITLE_CHUNK,
    FEATURE_READONLY_EDITOR,
    FEATURE_READ_REPORTS,
    FEATURE_READ_SCOPES,
    FEATURE_RECURSIVE_ACTIONS,
    FEATURE_REDIRECT_TO_EDITOR,
    FEATURE_SEARCH_JUMP_TO_CHUNK,
    FEATURE_STREAMING_DEBUG,
    FEATURE_STREAMING_DISABLE_1080p,
    FEATURE_STREAMING_DISABLE_540p,
    FEATURE_STREAMING_DISABLE_720p,
    FEATURE_STREAMING_START_360P,
    FEATURE_STREAMING_START_540P,
    FEATURE_STREAMING_START_720P,
    FEATURE_TERMS_AND_CONDITIONS,
    FEATURE_TEXT_TO_SPEECH,
    FEATURE_TRANSLATOR_ROLE,
    FEATURE_USERGROUPS_IN_USERACTION_EXPORT,
    FEATURE_USERTOKEN_LOGIN,
    FEATURE_VIDEOINDEXING,
    FEATURE_VIDEOS_WITH_AUDIO,
    FEATURE_VIDEO_STREAMING,
    FEATURE_GHENTIAN_DIALECT,
    FEATURE_MANUALTO_USER_MANAGEMENT_VIA_ENTRA_ID_GROUP,
    FEATURE_READ_CONFIRMATION,
    FEATURE_AG5,
] as const;
type AvailableFeatures = typeof FEATURES;
export type AccountFeatures = Partial<AvailableFeatures>;
export type IFeature = AvailableFeatures[number];

export const FEATURE_DESCRIPTIONS = {
    [FEATURE_ACCOUNT_ANALYTICS]: "Adds the 'Analytics' button to the main sidebar which navigates the user to the account analytics page.",
    [FEATURE_AD_SSO]: "Enables SSO (single sign on) support for the account (Microsoft Entra ID - formerly Active Directory, Okta).",
    [FEATURE_AI_CONTENT_FORMATTING]: "Enables AI content formatting support for the account. (Also called AI Content Optimization or Text Optimization) Preferred name is \"AI Content Optimization\"",
    [FEATURE_ALLOW_IFRAMES]: "Allows our app to be run in an iframe",
    [FEATURE_ANALYTICS]: "Adds a context menu item 'Analytics' which navigates to the analytics page for the given document showing document views over time and time per chunk.",
    [FEATURE_ANONYMOUS_RATING]: "If enabled, users have the options to make their rating anonymous.",
    [FEATURE_APPROVAL_FLOW]: "Makes it so every chunk in the editor must be approved before publishing. (Chunk by chunk approval)",
    [FEATURE_AUTOLOGOUT]: "Automatically logs out the user after a certain amount of time of inactivity",
    [FEATURE_AUTOMATED_ITEM_SORTING]: "Sort items in the editor and reader based on their title.",
    [FEATURE_BLOCK_CHECKLIST_PROGRESS]: "When enabled, a chunk needs to be marked as done/completed before being allowed to proceed to the next one.",
    [FEATURE_BROWSER_LOGO_FAVICON]: "Uses the accounts logo as the favicon in the browser tab.",
    [FEATURE_BROWSER_TAB_TITLE]: "In browser tabs, will replace the title (usually 'Manual.to') with the title of the current document or collection.",
    [FEATURE_BROWSE_VIEW_TTS_SUPPORT]: "Enables text-to-speech for the titles in the reader browser",
    [FEATURE_CEVA]: "Enables CEVA specific features, such as Excel imports and CEVA specific messaging.",
    [FEATURE_CHECKLISTS]: "Adds the possibility to mark chunks as done/completed in the reader.",
    [FEATURE_COLLECTION_HIDE]: "Adds a context menu item in the editor 'Hide collection in reader' which, as stated, will hide said collection from the reader. (Alpha quality, so don't use unless you know what you're doing)",
    [FEATURE_COMMENTING_IN_EDITOR]: "In the editor, when selecting a chunk, will show a button next to the 'Add chunk' button which allows the user to write a comment. This comment will only be visible inside the editor.",
    [FEATURE_CONTRIBUTOR_ROLE]: "Adds the contributor role. A contributor can edit documents but not delete, move or publish them.",
    [FEATURE_CUSTOM_NOTIFICATION_EMAIL_NAME]: "Uses the name of the user who created the custom notification as the sender name (in the email)",
    [FEATURE_DEBUG_LOGGING]: "Prints out the internal debug logging (DebugLog.log()). Should only be enabled by developers.",
    [FEATURE_DEVICE_LOGIN_PASSWORD]: "When logging in on a device, requires the user to enter their password before allowing them to log in.",
    [FEATURE_DEVICE_USER_IMPERSONATION]: "Enables the ability to mark users as 'device users' and link 'target users' to them, which can then be impersonated when the device user is logged in.",
    [FEATURE_DIALECTS]: "Extends language to include language variations such as Chinese to include 'Chinese (traditional)' and 'Chinese (simplified)'.",
    [FEATURE_DISABLE_CONCURRENT_LOGINS]: "User can be logged in only on one device/browser in the same time. This feature works well only for users of one account.",
    [FEATURE_DISABLE_PRELOADING]: "If enabled, will not preloading any videos or images except for the currently active one. Only to be used in extremely slow bandwidth scenarios (sub 1Mbps). Can also be enabled using the ?nopreload query parameter",
    [FEATURE_DISABLE_PUBLIC_ICON]: "When a document or collection is publicly accessible, it has a little globe next to the title. This feature hides that icon.",
    [FEATURE_DISABLE_SIGNUP]: "Always hides the sign up link when enabled.",
    [FEATURE_DOCUMENT_OWNER]: "Enable setting users and groups as owners for documents and collections",
    [FEATURE_DOWNLOAD_PDF_FROM_READER]: "Adds a button in the reader (next to the language buttons) that when clicked will convert the document to a pdf and download it.",
    [FEATURE_DUPLICATE_ACLS]: "When duplicating an item, also duplicates all permission rules on that item.",
    [FEATURE_EMOJIS_IN_EDITOR]: "Enables emoji's in chunk text. To insert an emoji type ':' and start typing a search term or description of the emoji you're looking for",
    [FEATURE_FORCE_LOWRES_VIDEO]: "Always uses a low resolution video no matter the internet connection stability. This feature should only be used as a temporary solution.",
    [FEATURE_GROUP_OWNERS]: "Allows to set group owners, which can then manage their group memberships.",
    [FEATURE_HISTORY_PANE]: "Adds the 'Past publications' pane on the reader (icon on the right sidebar when editing a document) which shows all previously published versions of the current document.",
    [FEATURE_INTERFACE_I18N]: "In reader>settings>languages and editor>preferences>language_preferences adds the option to change the language of our applications.",
    [FEATURE_LEGACY_READER_LANDING_PAGE]: "Enables the legacy reader landing page, which in public view shows nested public+advertized collections nested instead of serially. Deprecated for new accounts.",
    [FEATURE_LIVECHAT]: "Enabled Intercom",
    [FEATURE_LIVE_TRANSLATION_ON_READER]: "Adds a button on the reader inside the documents which translates the document to any supported language using machine translation.",
    [FEATURE_MANUALTO_CHUNK]: "Shows a 'Made with manual.to' + logo as last chunk in the reader + exported pdf's",
    [FEATURE_MULTILINGUAL_MEDIA]: "Adds the 'Language preference' option to the media pane in the editor. When this option is selected, we will show the images/videos matching the current language first on the reader. All images will always remain visible through the carousel.",
    [FEATURE_NOCDN]: "Disabled the CDN, meaning images and videos get served through our backend instead of Azure. Use with care as this will substantially decrease load times of visuals.",
    [FEATURE_NOTIFICATIONS]: "Adds the notification settings context menu item.",
    [FEATURE_PDF_EXPORT]: "Adds a button to export a publication as pdf in the 'Publishing' pane on the editor.",
    [FEATURE_PUBLICCONTENT]: "Adds an option in the user access settings (context menu > Access) which allows a document or collection to be set to public. This means a user does not have to be logged in to see their content on the reader.",
    [FEATURE_PUBLIC_API]: "Shows the public API token generator in the reader user preferences",
    [FEATURE_QR_CODE_LOGO]: "Adds an manual.to logo to the middle of generated QR codes",
    [FEATURE_READER_COMMENTING]: "Allows readers (that are logged in) to leave comments on specific chunks in a manual. Used to allow readers to point out issues in the manual.",
    [FEATURE_READER_RATING]: "Allows readers (that are logged in) to rate manuals, and leave a piece of feedback about their experience in the manual.",
    [FEATURE_READER_TITLE_CHUNK]: "Displays new title chunk design in the reader & disables title mirroring in the editor. ‼️ Warning: this feature should not be enabled without authorization. ‼️",
    [FEATURE_READONLY_EDITOR]: "Allows to give read only access to items in the editor. Do note that a user will still need edit access to at least 1 item to be allowed to log in to the editor.",
    [FEATURE_READ_REPORTS]: "Adds an option to the context menu 'Read sessions' which provides a list of view actions. When selecting a collection, it will show the view logs of all documents inside that collection.",
    [FEATURE_READ_SCOPES]: "When enabled, readers accessing a collection URL will see all items they have access to, even when those items are deeper in the collection hierarchy. This makes the behavior when accessing a collection URL more like our landing page.",
    [FEATURE_RECURSIVE_ACTIONS]: "Adds a context menu item, in the editor, called 'Batch actions' which allows the user to perform a delete, publish, unpublish or translate action on a collection and all documents and collections inside.",
    [FEATURE_REDIRECT_TO_EDITOR]: "Redirects users to their account specific editor url (company.editor.manual.to) when they're loading the general editor url (editor.manual.to)",
    [FEATURE_SEARCH_JUMP_TO_CHUNK]: "When navigating through the search results, will scroll down to the first occurence of the search query in the document.",
    [FEATURE_STREAMING_DEBUG]: "[DEBUGGING] Logs debug information about streaming to the console",
    [FEATURE_STREAMING_DISABLE_1080p]: "[DEBUGGING] Fully disables 1080p for this account, used when multiple devices have to use a shaky internet internet connection together",
    [FEATURE_STREAMING_DISABLE_540p]: "[DEBUGGING] Fully disables 540p for this account, used when multiple devices have to use a shaky internet internet connection together",
    [FEATURE_STREAMING_DISABLE_720p]: "[DEBUGGING] Fully disables 720p for this account, used when multiple devices have to use a shaky internet internet connection together",
    [FEATURE_STREAMING_START_360P]: "[DEBUGGING] Starts video streaming at 360p, the player can layer decide to go higher or lower, but this will be the first frame",
    [FEATURE_STREAMING_START_540P]: "[DEBUGGING] Starts video streaming at 540p, the player can layer decide to go higher or lower, but this will be the first frame",
    [FEATURE_STREAMING_START_720P]: "[DEBUGGING] Starts video streaming at 720p, the player can layer decide to go higher or lower, but this will be the first frame",
    [FEATURE_TERMS_AND_CONDITIONS]: "Shows the terms and conditions when loading the editor or reader for the first time. This needs a corresponding html file containing the t&c for that account to present in user-service/app/static/terms",
    [FEATURE_TEXT_TO_SPEECH]: "Adds a button which will read text aloud. The button is available, on the reader, for collection and document titles when browsing and inside documents.",
    [FEATURE_TRANSLATOR_ROLE]: "Adds the translator role. This role gives edit permissions only in the selected language.",
    [FEATURE_USERGROUPS_IN_USERACTION_EXPORT]: "Include usergroups of the user in the useraction export",
    [FEATURE_USERTOKEN_LOGIN]: "Allows login via a usertoken in the url. User tokens (jwt) can be generated by us or by the customer, for specific users. Can be done using a script in the credential service (a secret must be present in the user preferences)",
    [FEATURE_VIDEOINDEXING]: "Creates an audio transcription of uploaded videos, either straight into the chunk if the video is uploaded to an empty one, either makes it available to copy into clipboard.",
    [FEATURE_VIDEOS_WITH_AUDIO]: "Adds a toggle in the media pane to turn on audio for the selected video. Without this feature, audio will always be muted without an option to unmute.",
    [FEATURE_VIDEO_STREAMING]: "Instead of downloading the whole video before playing, will load part of the video and start playing while loading the rest of the video in the background. Due to better performance, this is the default",
    [FEATURE_ADD_USERS_IN_EDITOR]: "Adds the possibility to manually add users to the account from within the editor without sending an email. This means the email address can be fake, and password can be chosen. When this feature is enabled, the \"Add User\" button in the editor>users page will show an extra option to manually add a user.",
    [FEATURE_GHENTIAN_DIALECT]: "Adds the Ghentian dialect as a language option as a gimmick. To be used together with feature_language_dialects",
    [FEATURE_MANUALTO_USER_MANAGEMENT_VIA_ENTRA_ID_GROUP]: "Allows to manage users in Manual.to via an Entra ID group. This feature is only available for accounts with active directory SSO enabled.",
    [FEATURE_READ_CONFIRMATION]: "Requests confirmation from the user that they read the document at the end of it",
    [FEATURE_AG5]: "Enables the connection with AG5 to track skills in skill matrices",
}

export const DEFAULT_FEATURES: Array<{ feature: string; enabled: boolean; }> = [
    {
        feature: FEATURE_LIVECHAT,
        enabled: true,
    },
    {
        feature: FEATURE_VIDEO_STREAMING,
        enabled: true,
    }
];

export enum SAMLSSOMode {
    DISABLED,
    MULTI_AUTH,
    SINGLE_AUTH
}

export const defaultSAMLSSOSettings: () => ISAMLSSOSettings = () => (
    {
        tenantId: undefined,
        enabled: false,
        issuer: undefined,
        certificateName: undefined,
        entryPoint: undefined,
        samlSSOMode: SAMLSSOMode.DISABLED
    }
);

export const defaultAccountSettings: () => IAccountSettings = () => (
    {
        sso: {
            azure: {
                tenantId: undefined
            },
            saml: defaultSAMLSSOSettings()
        },
        visuals: {
            fitBehaviour: "crop"
        },
        languages: {
            defaultCode: undefined,
            interfaceLanguage: defaultLanguage,
        },
        pdfExport: {
            renderOnlyFirstCarrouselItem: true
        },
        mt: {
            generalOrder: [MTEngineType.Azure, MTEngineType.Google, MTEngineType.Deepl],
            pairs: {},
        },
        sorting: {
            sortMethod: AccountSortMethod.None
        }
    }
);

export interface IAccountFilter {
    name?: string;
    features?: IFeature[];
}

export interface IGetAccountOptions {
    checkForAdminPermission?: boolean;
    cdnnify?: boolean;
}

export enum ManageMemberTrigger {
    USER_IMPORT = 0,
    USER_INVITE = 1,
    SELF_SIGNUP = 2,
    SSO_SAML = 4,
    SSO_VCPA = 5,
    MANAGE = 6,
    ACCEPTANCE_TEST = 7,
    SCRIPT = 8,
    INTEGRATION_TEST = 9,
    ASSIGNED_AS_DEVICE_TARGET_USER = 10,
    PUBLIC_API = 11,
    EDITOR = 12,
    INACTIVE_USER_EXPIRATION = 13,
    BOOTSTRAP_TRIAL_ENV = 14,
    SSO_SAML_SYNC_ENTRA_GROUP = 15,
    MIGRATION = 16,
}

// {[featureName]: accountId[]}
export type IFeatureUsage = Record<string, string[]>;

export interface IAccountMembership {
    accountId: string;
    memberCount: number;
    manualToMemberCount: number;
    start: Date;
    end?: Date;
}

export interface CreateMSAccountSetupRequestParams {
    purchaseIdToken: string;
    firstName: string;
    lastName: string;
    phone: string;
    companyName: string;
    companySite: string;
    email: string;
}

export interface IMSAccountSetupRequest {
    purchaseIdToken: string;
    transactableId: string;
    subscriptionId: string;
    offerId: string;
    planId: string;
    tenantId: string;
    quantity: number;
    firstName: string;
    lastName: string;
    phone: string;
    companyName: string;
    companySite: string;
    email: string;
}

export interface ShortAccountInformation
    extends Pick<Account, "id" | "name" | "expirationDate"> {
    memberCount: number;
    domain: string;
}

export interface ResolvedMSPurchaseIdToken {
    id: string;
    purchaseIdToken: string;
    subscriptionId: string;
    subscriptionName: string;
    quantity: number;
    purchaserEmail: string;
}

export interface ResolveMSPurchaseIdTokenResponse {
    account: ShortAccountInformation | null;
    setupRequest: IMSAccountSetupRequest | null;
    purchase: ResolvedMSPurchaseIdToken;
}

export interface IMSTransactableSubscription {
    accountId: string;
    subscriptionId: string;
}

export interface MSTransactableOffersFullfillmentWebhookData {
    id: string;
    activityId: string;
    subscriptionId: string;
    offerId: string;
    publisherId: string;
    planId: string;
    quantity: number;
    action: "Reinstate" | "ChangePlan" | "ChangeQuantity" | "Suspend" | "Unsubscribe";
    timeStamp: string;
    status: "InProgress" | "NotStarted" | "Failed" | "Succeeded" | "Conflict";
}

export const ALL_USERS_GROUP = "All users";

export interface ICustomerInfo { customerId?: string, customerName?: string }
export interface ICustomersQuery { accountId?: string }

export type FeaturesByAccount = { features: string[], accountId: string }[];

export interface AccountServiceContract {
    listAccounts(includeHtmlHeadContent?: boolean): Promise<Array<Account>>;
    createAccount(
        name: string,
        subscriptionType: string,
        expirationDate: string,
        readerExpirationDate: string,
        maxNumberOfLicenses?: number,
        maxPublicCount?: number,
        customerInfo?: ICustomerInfo,
        id?: string,
        features?: string[],
    ): Promise<Account>;
    deleteAccount(accountId: string): Promise<void>;
    getAccount(accountId: string): Promise<Account>;
    addMember(
        accountId: string,
        userId: string,
        manageMemberTrigger: ManageMemberTrigger,
        skipDefaultPermissions?: boolean,
        fromUserId?: string,
        fromUserIp?: string | string[],
        fromUserAgent?: string
    ): Promise<Account>;
    addMembers(
        accountId: string,
        userId: Array<string>,
        manageMemberTrigger: ManageMemberTrigger,
        fromUserId?: string,
        fromUserIp?: string | string[],
        fromUserAgent?: string
    ): Promise<Array<Account>>;
    removeMember(
        accountId: string,
        userId: string,
        manageMemberTrigger: ManageMemberTrigger,
    ): Promise<Account>;
    removeMembers(
        accountId: string,
        userIds: string[],
        manageMemberTrigger: ManageMemberTrigger,
    ): Promise<Account>;
    update(
        accountId: string,
        name: string,
        subscriptionType: string,
        expirationDate: string,
        readerExpirationDate: string,
        maxNumberOfLicenses?: number,
        maxPublicCount?: number,
        customerInfo?: ICustomerInfo,
        htmlHeadContent?: string,
    ): Promise<Account>;
    getAccountsForUser(userId: string, options?: IGetAccountOptions): Promise<Account[]>;
    getAccountIdsForUser(userId: string): Promise<string[]>;
    getAccountIdsForUsersAndGroups(ids: string[]): Promise<Record<string, string[]>>;
    mine(options?: IGetAccountOptions): Promise<Account[]>;
    findAccountsForIds(accountIds: Array<string>): Promise<Array<Account>>;
    getAccountsForADTenant(tenantId: string): Promise<Account[]>;
    setAccountSubscription(accountId: string, subscriptionId: string): Promise<Account>;
    getAccountSettings(accountId: string): Promise<IAccountSettings>;
    getPublicAccountSettings(accountId: string): Promise<IPublicAccountSettings>;
    setAccountDefaultVisualSettings(accountId: string, visualSettings: IVisualsAccountSettings): Promise<void>;
    setAccountDefaultLanguageSettings(accountId: string, languageSettings: ILanguageAccountSettings): Promise<void>;
    setAccountDefaultInterfaceLanguage(accountId: string, languageSettings: ILanguageAccountSettings): Promise<void>;
    setAccountDefaultPDFExportSettings(accountId: string, settings: IPDFExportAccountSettings): Promise<void>;
    setAccountSecuritySettings(accountId: string, settings: SecuritySettings): Promise<void>;
    setAccountAG5Settings(accountId: string, settings: AG5Settings): Promise<void>;
    setAccountMTSettings(accountId: string, settings: IMTAccountSettings): Promise<void>;
    setAccountMTSettingsLanguagePair(
        accountId: string,
        languageCodesSerialized: string,
        engineType: MTEngineType | null,
        replacesLanguageCodesSerialized?: string,
    ): Promise<IMTAccountSettings>;
    setAccountSortMethod(accountId: string, sortMethod: AccountSortMethod): Promise<void>;
    setSSOSettings(accountId: string, ssoSettings: ISAMLSSOSettings): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/ban-types
    getSSOSettings(accountId: string): Promise<object>;
    getAccountFeatures(accountId: string): Promise<Array<string>>;
    getAccountFeaturesUsage(): Promise<IFeatureUsage>;
    setAccountFeatures(accountId: string, features: string[], options?: IUpdateFeaturesOptions): Promise<void>;
    linkFeature(accountId: string, feature: string): Promise<void>;
    unlinkFeature(accountId: string, feature: string): Promise<void>;
    findAccounts(filter: IAccountFilter): Promise<Array<Account>>;
    updateTotalPublicDocumentLicensing(accountId: string): Promise<void>;
    findExceedingLimitsLicensing(): Promise<AccountLicensing[]>;
    getAccountLicensing(accountId: string): Promise<AccountLicensing>;
    getHelpAccount(options?: IGetAccountOptions): Promise<Account>;
    generateUserTokenSecretForAccountId(accountId: string): Promise<string>;
    findAccountMemberships(accountId: string): Promise<IAccountMembership[]>;
    updateStorageDetails(accoundId: string, storageDetails: IAccountStorageDetails): Promise<Account>;
    createMSTransactableSetupRequest(
        createParams: CreateMSAccountSetupRequestParams
    ): Promise<void>;
    listMSTransactableSetupRequests(): Promise<IMSAccountSetupRequest[]>;
    getAccountSubscriptionByAccountId(accountId: string): Promise<IMSTransactableSubscription>;
    msTransactableOffersFullfillmentWebhook(
        data: MSTransactableOffersFullfillmentWebhookData
    ): Promise<void>;
    createMSTransactableSubscription(
        createParams: IMSTransactableSubscription
    ): Promise<void>;
    resolveMSPurchaseIdToken(purchseIdToken: string): Promise<ResolveMSPurchaseIdTokenResponse>;
    listCustomers(): Promise<ICustomer[]>;
    findCustomers(query: ICustomersQuery): Promise<ICustomer[]>;
    createCustomer(name: string, crmCustomerId: string, doCreateAccount: boolean, userId?: string): Promise<ICustomer>;
    updateCustomer(customerId: string, name: string, crmCustomerId: string): Promise<ICustomer>;
    deleteCustomer(customerId: string): Promise<void>;
    removeAccountFromCustomer(customerId: string, accountId: string): Promise<ICustomer>;
    addAccountToCustomer(customerId: string, accountId: string): Promise<ICustomer>;
    setAnonymised(accountId: string, isAnonymised: boolean): Promise<Account>;
    getAllFeaturesByAccount(): Promise<FeaturesByAccount>;
    getAccountsByFeatures(features: IFeature[]): Promise<Account[]>;
    bootstrapTrialEnvironment(props: BootstrapTrialEnvironmentProps): Promise<void>;
    getLaunchDarklyFlagsForFrontend(accountId: string, userId?: string): Promise<Record<LDFlags, unknown>>;
}

export type BootstrapTrialEnvironmentProps = {
    trialAccountId: string,
    templateCollectionId: string,
    companyName: string;
    firstName: string;
    lastName: string;
    login: string;
}
