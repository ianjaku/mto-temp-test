import posthog from "posthog-js";

/*
 * WARNING: Make sure the enum values are prefixed with the correct prefix
 * if same event is present in both editor and reader.
 */
const EDITOR_PREFIX = "Editor: ";
const READER_PREFIX = "Reader: ";

export enum EditorEvent {
    AiBinderOptimizationButtonClicked = "AI Binder Optimization: Button clicked",
    AiBinderOptimizationButtonClickedAgain = "AI Binder Optimization: Button clicked again (refresh)",
    AiBinderOptimizationCancelled = "AI Binder Optimization: Cancelled",
    AiBinderOptimizationFailed = "AI Binder Optimization: Failed",
    AiBinderOptimizationStarted = "AI Binder Optimization: Started",

    AiChunkOptimizationContextMenuClicked = "AI Chunk Optimization: Clicked (context menu)",
    AiChunkOptimizationApplied = "AI Chunk Optimization: Applied",
    AiChunkOptimizationUndone = "AI Chunk Optimization: Undone",

    AiGenerateManualUploadLLmFile = "AI Generate Manual: LLM File upload",
    AiGenerateManualSuccess = "AI Generate Manual: Success",

    BinderDiffAcceptAllClicked = "Binder Diff: Accepted All Chunks",
    BinderDiffAcceptChunkClicked = "Binder Diff: Accepted Chunk",
    BinderDiffCancelClicked = "Binder Diff: Cancelled",
    BinderDiffConfirmClicked = "Binder Diff: Confirm",
    BinderDiffRejectChunkClicked = "Binder Diff: Rejected Chunk",
    BinderDiffRetryChunkClicked = "Binder Diff: Retried Chunk",

    HomePageGoToDocumentClicked = "Home Page: Go to document",

    CommentThreadResolveClicked = "Comment Thread Resolve",

    SubmittedSearchbarQuery = "Submitted search bar query",
    SearchResultClicked = "Search Result Clicked",

    MediaPaneLanguageChanged = "Media Pane: Visual language preference changed",
    MediaPaneBehaviourChanged = "Media Pane: Visual behaviour changed",
    MediaPaneBackgroundColorChanged = "Media Pane: Visual background color changed",
    MediaPaneDownloadOriginal = "Media Pane: Editor downloaded original",
    MediaPaneViewMediaItemLarge = "Media Pane: Editor viewed visual in large",
    MediaPaneReplaceMediaItem = "Media Pane: Editor replaced visual",
    MediaPaneTurnMediaItem = "Media Pane: Editor turned visual",
    MediaPaneUploadButtonClicked = "Media Pane: upload visual icon clicked",
    MediaPaneSearchVisual = "Media Pane: Editor searched for visual",

    NavbarButtonClicked = "Navbar Button Clicked",

    InfoFlashMessageShown = "Info flash message shown",
    SuccessFlashMessageShown = "Success flash message shown",
    ErrorFlashMessageShown = "Error flash message shown",

    ApprovalChunkApproved = "Approval: Chunk approved",
    ApprovalChunkRejected = "Approval: Chunk rejected",
    ApprovalChunkCleared = "Approval: Chunk cleared",

    VisualUploaded = "Visual uploaded",
    CollectionCreated = "Collection created",
    DocumentCreated = "Document created",
    DocumentEdited = "Document edited",

    UserManagementAddUser = "User Management: User invited",
    UserManagementCreateWithCredentials = "User Management: User created with credentials",
    UserManagementImportCevaUsers = "User Management: Users imported from ceva",
    UserManagementImportUsers = "User Management: Users imported from csv",
    UserManagementCreateGroup = "User Management: Group created",
    UserManagementUpdateGroup = "User Management: Group updated",
    UserManagementAddGroupMember = "User Management: Group member added",
    UserManagementRemoveGroupMember = "User Management: Group member removed",
    UserManagementDeleteGroup = "User Management: Group deleted",

    BinderPdfExport = "Binder PDF Export",
    BinderPdfPreview = "Binder PDF Preview",
}

export enum ReaderEvent {
    DocumentOpened = "Document opened",
    CollectionOpened = "Collection opened",

    SubmittedSearchbarQuery = "Reader: Submitted search bar query",
    SearchResultClicked = "Reader Clicked Search Result",

    ReaderSharingCloseButtonClicked = "Reader sharing: close button clicked",
    ReaderSharingCopyLinkButtonClicked = "Reader sharing: copy link button clicked",
    ReaderSharingModalClickedOutside = "Reader sharing: modal clicked outside",
    ReaderSharingToolbarButtonClicked = "Reader sharing: toolbar button clicked",

    BindersLoaderError = "Reader Binder Loader: Error caught",
    BindersLoaderRedirect = "Reader Binder Loader: Redirect",

    DocumentPdfExport = "Document PDF Export",

    ReaderImageZoomed = "Reader: Image zoomed",

    DocumentReadConfirmationDisplayed = "Document read confirmation button was displayed",
    DocumentReadConfirmationClicked = "Document read confirmation button was clicked",

    ScrollHintClicked = "Scroll Hint button clicked",
    UserCookiesInitialConsent = "User Cookies Initial Consent",
    UserCookiesConsentChange = "User Cookies Consent Change",
}

export type FrontendEvent = EditorEvent | ReaderEvent;
export enum FrontendException {
    ApiUnexpectedStatusCode = "Api unexpected status code",
    UnexpectedError = "Unexpected error",
}

export interface EventProperties {
    [key: string]: string | number | boolean | null;
}

const capturePosthogEvent = (
    eventName: string,
    eventProperties?: EventProperties
): void => {
    posthog.capture(eventName, eventProperties);
}

const readerEventNamesSet = new Set<string>(Object.values(ReaderEvent));
const editorEventNamesSet = new Set<string>(Object.values(EditorEvent));

export const captureFrontendEvent = (
    eventName: FrontendEvent,
    eventProperties?: EventProperties
): void => {
    let eventNameWithPrefix = eventName as string;
    let eventPropertiesWithAppName = eventProperties ?? {};
    if (readerEventNamesSet.has(eventName)) {
        eventNameWithPrefix = eventName.startsWith(READER_PREFIX) ? eventName : `${READER_PREFIX}${eventName}`;
        eventPropertiesWithAppName = {
            ...eventProperties,
            appName: "reader"
        }
    } else if (editorEventNamesSet.has(eventName)) {
        eventNameWithPrefix = eventName.startsWith(EDITOR_PREFIX) ? eventName : `${EDITOR_PREFIX}${eventName}`;
        eventPropertiesWithAppName = {
            ...eventProperties,
            appName: "editor"
        }
    } else {
        throw new Error(`Unknown event name: ${eventName}`);
    }

    capturePosthogEvent(eventNameWithPrefix, eventPropertiesWithAppName);
}

export const stringifyEventProperties = (
    options: Record<string | number, unknown>,
): EventProperties => {
    return Object.keys(options ?? {}).reduce(
        (res, key) => res[key] == null ?
            res :
            ({ ...res, [key]: stringifyProperty(res[key]) }),
        {},
    );
}

const stringifyProperty = (value: unknown): EventProperties[0] => {
    switch (typeof value) {
        case "number":
        case "undefined":
        case "boolean":
        case "string":
            return value;
        default:
            return `${value}`
    }
}


export const captureFrontendException = (
    exceptionName: FrontendException,
    exceptionProperties?: EventProperties
): void => {
    const exceptionNameWithPrefix = exceptionName as string;
    capturePosthogEvent(exceptionNameWithPrefix, exceptionProperties ?? {});
}
