import * as React from "react";
import { APIGetPDFExportOptions, APITranslateHTMLChunk } from "../../binders/loader";
import {
    ActivateFeaturesSideEffect,
    BypassChecklistBlockModeSideEffect
} from "../../stores/hooks/side-effects";
import {
    ActiveDocumentWithModules,
    ActiveParentCollection,
    useBinderStoreState
} from "../../stores/zustand/binder-store";
import {
    Binder,
    IAzureTranslation,
    IChecklist,
    Publication,
    PublicationFindResult,
    Translation
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { COMMENTS_SIDEBAR_ID, CommentsSidebar } from "./CommentsSidebar/CommentsSidebar";
import {
    FEATURE_BLOCK_CHECKLIST_PROGRESS,
    FEATURE_BROWSER_TAB_TITLE,
    FEATURE_MANUALTO_CHUNK,
    FEATURE_NOCDN
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    HideRibbonFunction,
    ShowRibbonFunction
} from "@binders/ui-kit/lib/compounds/ribbons/RibbonsView";
import {
    QUERY_PARAM_MTLC,
    useQueryParam,
    useRemoveQueryParam
} from "@binders/client/lib/react/hooks/useQueryParams";
import {
    ReaderEvent,
    captureFrontendEvent,
    stringifyEventProperties
} from "@binders/client/lib/thirdparty/tracking/capture";
import Ribbon, { RibbonType } from "@binders/ui-kit/lib/elements/ribbon";
import {
    UseModalResponse,
    useModal
} from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import {
    WindowDimensions,
    useWindowDimensions
} from "@binders/ui-kit/lib/hooks/useWindowDimensions";
import { differenceInMinutes, minutesToMilliseconds } from "date-fns";
import { getReaderDomain, isPreviewPath } from "../../util";
import {
    isBypassChecklistBlockCookieSet,
    setBypassChecklistBlockCookie
} from "@binders/client/lib/util/cookie";
import {
    loadAndActivatePublication,
    selectLanguage,
    unloadPublication
} from "../../binders/binder-loader";
import {
    useActiveAccountFeatures,
    useActiveAccountId,
    useActiveAccountSettings,
    useIsAccountFeatureActive
} from "../../stores/hooks/account-hooks";
import { useCurrentUserId, useIsLoggedIn } from "../../stores/hooks/user-hooks";
import { useHideRibbon, useShowRibbon } from "@binders/ui-kit/lib/compounds/ribbons/hooks";
import { useIsLandscape, useWaitingForResize } from "../../stores/hooks/orientation-hooks";
import { APITempLog } from "../../api/devopsService";
import type { AccountStoreState } from "../../stores/zustand/account-store";
import Button from "@binders/ui-kit/lib/elements/button";
import { Div100Vh } from "../../utils/div100vh";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { FEEDBACK_CHUNK_DATAPROP } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import FlashMessages from "@binders/client/lib/react/flashmessages/component";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { IPDFExportOptions } from "@binders/client/lib/clients/exportservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import {
    LaunchDarklyFlagsStoreGetters
} from "@binders/ui-kit/lib/thirdparty/launchdarkly/ld-flags-store";
import { LoadingFullPage } from "../lazy/Loading";
import { MediaModule } from "./modules/media";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { RouteComponentProps } from "react-router-dom";
import { ScrollHintContextProvider } from "./ScrollHint/ScrollHintContext";
import { TFunction } from "@binders/client/lib/i18n";
import { TabInfo } from "@binders/ui-kit/lib/elements/tabinfo/TabInfo";
import { TextModule } from "./modules/text";
import ThemeProvider from "@binders/ui-kit/lib/theme";
import Timer from "../../helpers/TimerHelper";
import { Toolbar } from "./Toolbar";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import autobind from "class-autobind";
import { countWords } from "../../utils/HtmlHelper";
import debounce from "lodash.debounce";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import { getLanguageLabel } from "../../utils/languages";
import { isIOSSafari } from "@binders/client/lib/react/helpers/browserHelper";
import { isProduction } from "@binders/client/lib/util/environment";
import { loadDocsToEdit } from "../../stores/actions/account";
import { pdfExport } from "../../binders/binder-loader";
import { resolveAdditionalChunks } from "../../utils/additionalChunks";
import { useActiveViewable } from "../../stores/hooks/binder-hooks";
import { useChecklistStoreState } from "../../stores/zustand/checklist-store";
import { useTrackingStoreState } from "../../stores/zustand/tracking-store";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./reader.styl";
import "@binders/client/assets/flashmessages.styl";

const MT_DISCLAIMER_RIBBON_ID = "mt-disclaimer";
const NEWER_PUBLICATION_RIBBON_ID = "newer-publication";
const INACTIVE_DURATION_MINUTES = 5;

const getPreviewChunk = (viewable: ActiveDocumentWithModules, query: Record<string, string>) => {
    if (!viewable) {
        return undefined;
    }
    if (query.previewChunk !== undefined) {
        return parseInt(query.previewChunk, 10);
    }
    if (query.jumpToText) {
        const decodedText = decodeURI(query.jumpToText);
        const chunkIndex = viewable.textModule.findIndex((chunks) => {
            const singleHtmlChunk = chunks.join("");
            const tmpNode = document.createElement("div");
            tmpNode.innerHTML = singleHtmlChunk;
            const singleTextChunk = tmpNode.textContent || tmpNode.innerText || "";
            tmpNode.remove();
            return (
                singleTextChunk.indexOf(decodedText) > -1 ||
                singleTextChunk.indexOf(decodedText.replace(/[>;]/g, "").trim()) > -1
            );
        });
        if (chunkIndex !== -1) {
            return chunkIndex;
        }
        return 0;
    }
    return 0;
}

const timer = Timer.create();

export type ReaderProps = {
    router: RouteComponentProps
};

type InternalReaderProps = ReaderProps & {
    accountFeatures: AccountStoreState["features"];
    accountSettings: AccountStoreState["settings"];
    accountId: string;
    checklistProgressBlock: boolean;
    commentsSidebar: UseModalResponse<unknown, unknown>;
    checklists: IChecklist[];
    hideRibbon: HideRibbonFunction;
    isLoggedIn?: string;
    machineTranslatedLanguageCode?: string;
    removeMachineTranslatedLanguageCodeQueryParam: () => void;
    router: RouteComponentProps;
    sessionId: string;
    showRibbon: ShowRibbonFunction;
    t: TFunction;
    userId: string;
    waitingForResize: boolean;
    windowDimensions: WindowDimensions;
    // Zustand props
    activeViewable?: ActiveDocumentWithModules;
    activeParentCollection?: ActiveParentCollection;
    availableTranslations?: IAzureTranslation[];
    newerPublication?: PublicationFindResult;
    ratingEnabled?: boolean;
    readConfirmationEnabled?: boolean;
    isLandscape: boolean;
};

type ReaderState = {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    activeImageModule: any[];
    /* eslint-enable @typescript-eslint/no-explicit-any */
    activeTextModule: string[][];
    currentTimingChunk: number;
    downloadingPdf: boolean;
    hasNewerPublication: boolean;
    imageViewportDims: IDims;
    isBypassChecklistBlockMode: boolean;
    isPreviewMode: boolean;
    isSingleUndefinedLanguage: boolean;
    isTranslating: boolean;
    languageCode: string;
    loggingEnabled: boolean;
    previewChunk: number;
    toolbarCollapsed: boolean;
    translatedLanguage: string;
    translatedTitle: string;
    translationModalIsOpened: boolean;
    translations: string[];
    viewPortHeight: string;
    viewableTranslations: Translation[];
    tailslotRef?: HTMLDivElement;
};

const CHUNK_SEPARATOR = "<!-- CHUNK_SEPARATOR -->";
const API_CHAR_LIMIT = 5000;
class Reader extends React.Component<InternalReaderProps, ReaderState> {

    private lastActivityMoment = undefined;
    private inactive = false;
    private mounted: boolean
    private readonly beforeUnload: () => void;
    private onf: () => void;
    private loggedBeforeUnload: boolean;
    private checkInactivityInternalID: NodeJS.Timeout;
    private onKeyDown: (this: Document, ev: KeyboardEvent) => void;

    static parseQuery(queryString: string): Record<string, string> {
        // remove any preceding url and split
        const queryArr = queryString.substring(queryString.indexOf("?") + 1).split("&");
        return queryArr.reduce((out, query) => {
            const pair = query.split("=");
            const key = decodeURIComponent(pair[0]);
            out[key] = decodeURIComponent(pair[1] || "");
            return out;
        }, {});
    }

    static getActiveViewableLanguageCode(activeViewable?: ActiveDocumentWithModules) {
        if (!activeViewable) return null;
        const { languageCodeForPreview } = activeViewable;
        const { language } = activeViewable as Publication;
        return language ? language.iso639_1 : languageCodeForPreview;
    }

    constructor(props: InternalReaderProps) {
        super(props);
        autobind(this, Reader.prototype);
        this.beforeUnload = this.logChunkBeforeUnload.bind(this)
        this.resetInactivityPeriod = debounce(this.resetInactivityPeriod, 1000);

        const { location } = props.router;
        const { pathname } = location;
        const isPreviewMode = isPreviewPath(pathname);
        const loggingEnabled = !isPreviewMode;

        this.state = {
            activeImageModule: null,
            activeTextModule: null,
            currentTimingChunk: 0,
            downloadingPdf: false,
            hasNewerPublication: !!props.newerPublication,
            imageViewportDims: { width: 0, height: 0 },
            isBypassChecklistBlockMode: isBypassChecklistBlockCookieSet(),
            isPreviewMode,
            isSingleUndefinedLanguage: false,
            isTranslating: false,
            languageCode: undefined,
            loggingEnabled,
            previewChunk: 0,
            toolbarCollapsed: false,
            translatedLanguage: undefined,
            translatedTitle: undefined,
            translationModalIsOpened: false,
            translations: undefined,
            viewPortHeight: undefined,
            viewableTranslations: [],
            tailslotRef: undefined,
        };
    }

    async componentDidMount() {
        window.scrollTo(0, 1); // to try to get rid of the scroll bar
        document.addEventListener("keydown", this.onKeyDown);
        timer.start();
        window.addEventListener("beforeunload", this.beforeUnload);
        window.addEventListener("blur", this.onBlur.bind(this));
        this.mounted = true;
        this.loggedBeforeUnload = false;
        this.checkInactivityInternalID = setInterval(this.checkInactivityPeriod.bind(this), minutesToMilliseconds(1));
        this.lastActivityMoment = new Date();
        this.adjustViewPortHeightOnIphone7();
        setTimeout(() => this.adjustViewPortHeightOnIphone7(), 0);
        this.maybeShowRedirectedFromLanguageInfo();
        loadDocsToEdit(this.props.accountId);

        const stateUpdates: Partial<ReaderState> = {};

        if (this.props.activeViewable) {
            stateUpdates.activeTextModule = this.props.activeViewable.textModule;
            stateUpdates.activeImageModule = this.props.activeViewable.imageModule;
            stateUpdates.languageCode = Reader.getActiveViewableLanguageCode(this.props.activeViewable);
            stateUpdates.viewableTranslations = (this.props.activeViewable as Publication).translations || [];
            stateUpdates.currentTimingChunk = getPreviewChunk(this.props.activeViewable, Reader.parseQuery(location.search || ""));
            stateUpdates.previewChunk = getPreviewChunk(this.props.activeViewable, Reader.parseQuery(location.search || ""));
        }

        if (this.props.newerPublication) {
            stateUpdates.hasNewerPublication = !!this.props.newerPublication;
        }

        if (this.props.activeViewable) {
            this.maybeLogChooseLanguageEvent();
        }

        if (Object.keys(stateUpdates).length) {
            this.setState(stateUpdates as ReaderState);
        }
    }

    async componentDidUpdate(prevProps: InternalReaderProps, prevState: ReaderState) {
        const viewableTranslations = this.props.activeViewable ? (this.props.activeViewable as Publication).translations || [] : [];
        setTimeout(() => this.adjustViewPortHeightOnIphone7(), 0);

        const stateUpdates: Partial<ReaderState> = {};

        if (this.props.activeViewable && (!prevProps.activeViewable || this.props.activeViewable.id !== prevProps.activeViewable.id)) {
            this.maybeLogChooseLanguageEvent();
            stateUpdates.activeImageModule = this.props.activeViewable.imageModule;
            stateUpdates.activeTextModule = this.props.activeViewable.textModule;
            const previewChunk = getPreviewChunk(this.props.activeViewable, Reader.parseQuery(location.search || ""))
            stateUpdates.currentTimingChunk = previewChunk || 0;
            stateUpdates.previewChunk = previewChunk || 0;
            stateUpdates.languageCode = Reader.getActiveViewableLanguageCode(this.props.activeViewable);
            stateUpdates.viewableTranslations = viewableTranslations;
        }

        if (this.props.newerPublication !== prevProps.newerPublication) {
            stateUpdates.hasNewerPublication = !!this.props.newerPublication;
        }

        // Maybe show newer publication ribbon
        if (!prevState.hasNewerPublication && this.state.hasNewerPublication) {
            const link = this.getNewerPublicationLink(
                this.props.newerPublication,
                this.state.languageCode
            );
            this.props.showRibbon(
                NEWER_PUBLICATION_RIBBON_ID,
                { position: "top", hideOnRouteChange: true, overwrite: true },
                ({ hide }) => (
                    <Ribbon
                        type={RibbonType.INFO}
                        closeable={true}
                        onRequestClose={() => {
                            this.setState({
                                hasNewerPublication: false,
                            });
                            hide();
                        }}
                        customClasses="newer-publication"
                    >
                        <label>{this.props.t(TranslationKeys.Publish_NewVersionAvailableInfo)}</label>
                        <a href={link}>{this.props.t(TranslationKeys.General_Here)}</a>
                    </Ribbon>
                )
            );
        }

        if (this.state.viewableTranslations?.length !== prevState.viewableTranslations?.length || this.state.languageCode !== prevState.languageCode) {
            stateUpdates.isSingleUndefinedLanguage = viewableTranslations.length === 1 && this.state.languageCode === UNDEFINED_LANG;
        }

        if (this.props.machineTranslatedLanguageCode) {
            await this.maybeAutoMachineTranslate();
        }

        if (Object.keys(stateUpdates).length) {
            this.setState(stateUpdates as ReaderState);
        }
    }

    maybeLogChooseLanguageEvent() {
        if (!this.state.loggingEnabled) {
            return;
        }
        eventQueue.log(EventType.CHOOSE_LANGUAGE, this.props.accountId, {
            binderId: (this.props.activeViewable as Publication).binderId,
            collectionId: this.props.activeParentCollection?.id || undefined,
            document: this.props.activeViewable.id,
            language: Reader.getActiveViewableLanguageCode(this.props.activeViewable).toUpperCase(),
            sessionId: this.props.sessionId,
            userId: this.props.userId,
        });
    }

    async maybeAutoMachineTranslate() {
        const machineTranslatedLanguage = this.props.machineTranslatedLanguageCode;
        if (machineTranslatedLanguage && (this.state.isTranslating || this.state.translatedLanguage === machineTranslatedLanguage)) {
            return;
        }
        this.props.removeMachineTranslatedLanguageCodeQueryParam();
        await this.onTranslate(machineTranslatedLanguage);
    }

    maybeShowRedirectedFromLanguageInfo() {
        const redirectedFromLangCode = new URLSearchParams(document.location.search).get("redirectedFromLangCode");
        if (!redirectedFromLangCode) {
            return;
        }
        const language = getLanguageLabel(redirectedFromLangCode);
        FlashMessageActions.info(this.props.t(
            TranslationKeys.DocManagement_RedirectedFromLangCodeInfo,
            { language },
        ));
    }

    adjustViewPortHeightOnIphone7() {
        if (
            isIOSSafari() &&
            document.body.clientHeight > document.body.clientWidth &&
            document.body.clientHeight < 800
        ) {
            this.setState({ viewPortHeight: "100%" });
        }
    }

    checkInactivityPeriod() {
        if (this.inactive) {
            return;
        }
        const minutesDifference = differenceInMinutes(new Date(), this.lastActivityMoment);
        if (minutesDifference > INACTIVE_DURATION_MINUTES) {
            this.inactive = true;
            this.logReadSessionBlur();
        }
    }

    resetInactivityPeriod() {
        this.lastActivityMoment = new Date();
        if (this.inactive) {
            this.logReadSessionFocus();
        }
        this.inactive = false;
    }

    disableBypassChecklistBlockMode() {
        setBypassChecklistBlockCookie(false);
        window.location.reload();
    }

    private setImageViewportDims(width: number, height: number): void {
        this.setState({
            imageViewportDims: { width, height }
        });
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyDown);
        unloadPublication();
        this.mounted = false;
        this.logCurrentChunkBrowsed();
        this.logDocumentClosed();
        window.removeEventListener("beforeunload", this.beforeUnload);
        window.removeEventListener("blur", this.onBlur);
        clearInterval(this.checkInactivityInternalID);

    }

    maybeTempLog() {
        if (!(window.location?.search?.includes("logmem=1"))) {
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const memory = (window.performance as any)?.memory;
        if (memory) {
            const {
                jsHeapSizeLimit,
                totalJSHeapSize,
                usedJSHeapSize
            } = memory;
            APITempLog(`jsHeapSizeLimit ${jsHeapSizeLimit} totalJSHeapSize ${totalJSHeapSize} usedJSHeapSize ${usedJSHeapSize}`);
        }
    }

    onChunkChange(currentChunk: number, newChunk: number) {
        const { activeTextModule } = this.state;
        this.logChunkBrowsed(currentChunk, newChunk);
        timer.start()
        const isLastChunk = newChunk === activeTextModule.length - 1;
        const isScrollingDown = currentChunk < newChunk;
        const toolbarCollapsed = newChunk !== 0 && isScrollingDown && !isLastChunk;
        this.setState({
            toolbarCollapsed,
            currentTimingChunk: newChunk,
        });
        this.maybeTempLog();
    }

    onBlur() {
        if (!this.mounted) {
            return;
        }
        this.logCurrentChunkBrowsed();
        this.logReadSessionBlur();
        this.onf = this.onFocus.bind(this);
        window.addEventListener("focus", this.onf);
    }

    onFocus() {
        this.logReadSessionFocus();
        timer.start();
        window.removeEventListener("focus", this.onf);
        this.resetInactivityPeriod();
        this.inactive = false;
    }

    logReadSessionBlur() {
        const {
            loggingEnabled
        } = this.state;
        const { accountId, sessionId, activeViewable } = this.props;
        if (!loggingEnabled || !activeViewable) {
            return;
        }
        eventQueue.log(
            EventType.READ_SESSION_BLUR,
            accountId,
            {
                documentId: activeViewable.id,
                binderId: (activeViewable as Publication).binderId,
                sessionId,
            },
        );
    }

    logReadSessionFocus() {
        const {
            loggingEnabled
        } = this.state;
        const { accountId, sessionId, activeViewable } = this.props;
        if (!loggingEnabled || !activeViewable) {
            return;
        }
        eventQueue.log(
            EventType.READ_SESSION_FOCUS,
            accountId,
            {
                documentId: activeViewable.id,
                binderId: (activeViewable as Publication).binderId,
                sessionId,
            },
        );
    }

    logCurrentChunkBrowsed(now = false) {
        const { activeTextModule, currentTimingChunk } = this.state;
        if (!activeTextModule || this.loggedBeforeUnload) {
            return;
        }
        if (currentTimingChunk >= 0) {
            this.logChunkBrowsed(currentTimingChunk, currentTimingChunk, now);
        }
        if (currentTimingChunk === activeTextModule.length - 1) {
            window.removeEventListener("beforeunload", this.logChunkBeforeUnload.bind(this));
        }
        if (activeTextModule.length === 1) {
            this.logChunkBrowsed(0, 0);
        }
    }

    logDocumentClosed(now = false) {
        const {
            loggingEnabled,
        } = this.state;
        const { sessionId, userId, activeViewable, activeParentCollection } = this.props;
        if (!activeViewable || !loggingEnabled) {
            return;
        }
        eventQueue.log(
            EventType.DOCUMENT_CLOSED,
            this.props.accountId,
            {
                collectionId: activeParentCollection ? activeParentCollection.id : undefined,
                documentType: activeViewable.documentType,
                documentId: activeViewable.id,
                binderId: (activeViewable as Publication).binderId,
                sessionId,
            },
            now,
            userId,
        );
    }

    logChunkBrowsed(oldChunk: number, newChunk: number, now = false) {
        const {
            activeTextModule,
            loggingEnabled,
        } = this.state;
        const { sessionId, userId, activeViewable, activeParentCollection } = this.props;
        if (!activeViewable || !loggingEnabled) {
            return;
        }
        eventQueue.log(
            EventType.CHUNK_BROWSED,
            this.props.accountId,
            {
                oldChunk,
                newChunk,
                collectionId: activeParentCollection ? activeParentCollection.id : undefined,
                documentType: activeViewable.documentType,
                documentId: activeViewable.id,
                binderId: (activeViewable as Publication).binderId,
                timeSpend: timer.stop(),
                words: countWords(activeTextModule[oldChunk]),
                sessionId,
            },
            now,
            userId,
        );
    }

    logChunkBeforeUnload() {
        if (this.mounted) {
            this.logCurrentChunkBrowsed(true);
            this.logDocumentClosed(true);
            this.loggedBeforeUnload = true;
        }
    }

    async switchLanguage(translation: Translation) {
        const { accountFeatures } = this.props;
        selectLanguage(translation.languageCode);
        await loadAndActivatePublication(
            translation.publicationId,
            [],
            resolveAdditionalChunks(accountFeatures, this.props.ratingEnabled, this.props.readConfirmationEnabled),
        );
        this.setState({
            translatedTitle: undefined,
            translations: undefined,
            translatedLanguage: undefined,
        });
        this.props.hideRibbon(MT_DISCLAIMER_RIBBON_ID);
    }

    setToolbarCollapsed(toolbarCollapsed: boolean) {
        this.setState({ toolbarCollapsed })
    }

    showToolbar() {
        this.setToolbarCollapsed(false);
    }

    getNewerPublicationLink(publication: PublicationFindResult, languageCode: string) {
        if (!publication) {
            return "#";
        }
        const { binderId } = publication;
        const link = `/launch/${binderId}`;

        const searchParams = new URLSearchParams();
        if (languageCode) {
            searchParams.set("lang", languageCode);
        }
        if (!isProduction()) {
            searchParams.set("domain", getReaderDomain());
        }
        return searchParams.size > 0 ? `${link}?${searchParams}` : link;
    }


    downloadBlob(blob: Blob, filename: string) {
        if (window.navigator["msSaveOrOpenBlob"]) {  // IE only
            window.navigator["msSaveBlob"](blob, filename);
        } else {
            const link = document.createElement("a");
            link.href = window.URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }
    }

    onToggleTranslationModal() {
        const translationModalIsOpened = !this.state.translationModalIsOpened;
        this.setState({ translationModalIsOpened });
    }

    startTranslation() {
        this.setState({
            translationModalIsOpened: false,
            isTranslating: true,
        });
    }

    endTranslation(translations: string[], translatedLanguage: string) {
        this.setState({ isTranslating: false, translations, translatedLanguage });
        const useChunkDisclaimers = LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.READER_SHARE_MT_DOCUMENTS];
        if (!useChunkDisclaimers) {
            this.props.showRibbon(
                MT_DISCLAIMER_RIBBON_ID,
                { position: "top", hideOnRouteChange: true, overwrite: true },
                ({ hide }) => (
                    <Ribbon
                        type={RibbonType.INFO}
                        closeable={true}
                        onRequestClose={hide}
                        translucent={false}
                    >
                        <label>{this.props.t(TranslationKeys.DocManagement_MachineTranslationWarning)}</label>
                    </Ribbon>
                )
            );
        }
    }

    buildTextToTranslate(start = 0) {
        const { activeTextModule: chunks } = this.state;
        let chunksRead = 0;
        const paragraphs = [];

        const output = {
            text: "",
            chunksRead: 0,
            hasCharsToRead: false
        };

        let postLength = 0;
        for (let i = start; i < chunks.length; i++) {
            const chunk = chunks[i];
            const paragraph = chunk.join("\n");
            postLength += paragraph.length;
            const limit = postLength + (CHUNK_SEPARATOR.length * paragraphs.length);
            if (limit > API_CHAR_LIMIT) {
                if (i === start) {
                    paragraphs.push(chunk.length === 0 ? "" : paragraph.substring(0, API_CHAR_LIMIT - 1));
                    chunksRead = start;
                    output.hasCharsToRead = (i < chunks.length - 1);
                } else {
                    output.hasCharsToRead = true;
                }
                break;
            }
            paragraphs.push(chunk.length === 0 ? "" : paragraph);
            chunksRead = i + 1;
        }

        return {
            ...output,
            text: paragraphs.join(CHUNK_SEPARATOR),
            chunksRead,
        };
    }

    logTranslation(translationCode: string) {
        const {
            languageCode,
            viewableTranslations: translations,
        } = this.state;
        const { sessionId, userId, activeViewable, activeParentCollection } = this.props;
        const translation = translations.find(t => t.languageCode === languageCode);
        eventQueue.log(
            EventType.CHOOSE_LANGUAGE,
            this.props.accountId,
            {
                source: translation ? translation.publicationId : undefined,
                binderId: (activeViewable as Publication).binderId,
                collectionId: activeParentCollection ? activeParentCollection.id : undefined,
                language: `${translationCode.toUpperCase()}*`,
                sessionId,
                isMachineTranslation: true,
            },
            false,
            userId,
        )
    }

    async onTranslate(language: string) {
        const { languageCode: fromLanguage } = this.state;
        const { accountId, activeViewable: viewable } = this.props;

        this.startTranslation();
        const textPieces: string[] = [];
        let start = 0;
        let shouldRead = true;
        while (shouldRead) {
            const { text, chunksRead, hasCharsToRead } = this.buildTextToTranslate(start);
            shouldRead = hasCharsToRead;
            start = chunksRead;
            textPieces.push(text);
        }
        try {
            const translatedPieces = await Promise.all(
                textPieces
                    .map(p => p.replace(`${CHUNK_SEPARATOR}${FEEDBACK_CHUNK_DATAPROP}`, ""))
                    .map(p => APITranslateHTMLChunk(accountId, p, fromLanguage, language))
            );
            const translations = translatedPieces.flatMap(translatedPiece => translatedPiece.split(CHUNK_SEPARATOR));
            const publication = viewable as Publication;
            const title = viewable && publication.language && publication.language.storyTitle;
            const translatedTitle = title ?
                await APITranslateHTMLChunk(
                    accountId,
                    title,
                    fromLanguage,
                    language,
                ) :
                undefined;
            this.setState({ translatedTitle });
            this.logTranslation(language);
            this.endTranslation(translations, language);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            const errorMessage = this.props.t(TranslationKeys.DocManagement_CantTranslate);
            const errorKey = FlashMessageActions.error(errorMessage);
            setTimeout(() => FlashMessageActions.dismissMessage(errorKey), 3000);
            this.setState({
                translationModalIsOpened: false,
                isTranslating: false
            });
            this.props.hideRibbon(MT_DISCLAIMER_RIBBON_ID);
        }

    }

    async onPdfDownload() {
        const {
            downloadingPdf,
            languageCode,
            translatedLanguage,
            translations,
            translatedTitle,
        } = this.state;
        const {
            accountFeatures,
            accountSettings,
            activeViewable: viewable,
        } = this.props;
        if (downloadingPdf || !viewable || viewable.documentType !== "publication") {
            return;
        }
        try {
            this.setState({ downloadingPdf: true });
            const itemId = viewable.id;
            const publication = viewable as Publication;
            const title = translatedTitle || publication.language.storyTitle;
            const viewablePdfExport = await APIGetPDFExportOptions(publication.binderId, languageCode);
            const options = viewablePdfExport || accountSettings.pdfExport;
            let pdfExportOptions: IPDFExportOptions = { ...options };
            if (translations) {
                pdfExportOptions = {
                    ...pdfExportOptions,
                    translatedChunks: translations,
                    languageCode: translatedLanguage
                }
            }
            pdfExportOptions = {
                ...pdfExportOptions,
                cdnnify: !accountFeatures.includes(FEATURE_NOCDN),
                shouldRenderAdditionalChunk: accountFeatures.includes(FEATURE_MANUALTO_CHUNK)
            }
            const buffer = await pdfExport(itemId, getReaderDomain(), pdfExportOptions);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const blob = new Blob([new Uint8Array(buffer.data as any)]);
            this.downloadBlob(blob, `${title}_${fmtDateIso8601TZ(new Date())}.pdf`);
            captureFrontendEvent(ReaderEvent.DocumentPdfExport, stringifyEventProperties({ itemId, ...pdfExportOptions }));
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            const messageKey = FlashMessageActions.error(this.props.t(TranslationKeys.DocManagement_CantDownloadPdf));
            setTimeout(() => FlashMessageActions.dismissMessage(messageKey), 3000);
        }
        finally {
            this.setState({ downloadingPdf: false });
        }
    }

    getAvailableTranslationsElements() {
        const { viewableTranslations } = this.state;
        const { availableTranslations } = this.props;
        return availableTranslations && availableTranslations
            .reduce((out, t) => {
                if (viewableTranslations.findIndex(v => v.languageCode === t.code) === -1) {
                    out.push({
                        id: t.code,
                        value: t.code,
                        label: `${t.name} / ${t.nativeName}`,
                    });
                }
                return out;
            }, []);
    }

    toggleCommentsSidebar() {
        this.props.commentsSidebar.toggle();
    }

    renderTranslationModal() {
        const { translationModalIsOpened } = this.state;

        return !translationModalIsOpened ?
            null :
            (
                <Modal
                    buttons={[
                        <Button
                            secondary
                            isEnabled={true}
                            text={this.props.t(TranslationKeys.General_Cancel)}
                            onClick={this.onToggleTranslationModal.bind(this)}
                        />
                    ]}
                    classNames="translation-modal"
                    title={this.props.t(TranslationKeys.DocManagement_SelectLanguage)}
                    onHide={this.onToggleTranslationModal.bind(this)}
                >
                    <div className="translation-modal-body">
                        <div className="machinetranslation-input">
                            <span>{this.props.t(TranslationKeys.DocManagement_ShowMachineTranslation)}</span>
                            <FilterableDropdown
                                key="add-languages-dropdown"
                                type={this.props.t(TranslationKeys.General_Languages)}
                                className="add-languages-dropdown"
                                elements={this.getAvailableTranslationsElements()}
                                onSelectElement={this.onTranslate.bind(this)}
                                maxRows={7}
                                defaultOpened={false}
                            />
                        </div>
                        <label className="machinetranslation-disclaimer">{this.props.t(TranslationKeys.DocManagement_MachineTranslationWarningBefore)}</label>
                    </div>
                </Modal>
            );
    }

    render() {
        const {
            activeImageModule,
            activeTextModule,
            imageViewportDims,
            languageCode,
            previewChunk,
            translatedLanguage,
            translatedTitle,
            translations,
        } = this.state;
        const {
            isLandscape,
            accountFeatures,
            accountId,
            checklists,
            userId,
            waitingForResize,
            windowDimensions,
            activeViewable,
        } = this.props;

        const showTabInfo = accountFeatures.includes(FEATURE_BROWSER_TAB_TITLE);

        if (!activeViewable || !activeTextModule || !activeImageModule) {
            return <LoadingFullPage />;
        }

        const viewablePublication = activeViewable as Publication;
        const viewableBinder = activeViewable as Binder;

        const binderId = viewablePublication.binderId || activeViewable.id;
        const binderLog = viewablePublication.binderLog;
        const language = viewablePublication.language || viewableBinder.languages?.[0];

        const shouldDisplayToolbar = !(this.props.commentsSidebar?.isOpen) && !this.state.isPreviewMode;

        return (
            <ThemeProvider>
                {showTabInfo && <TabInfo title={language?.storyTitle} />}
                <div
                    className="reader-layout-wrapper"
                    onMouseMove={this.resetInactivityPeriod.bind(this)}
                    onClick={this.resetInactivityPeriod.bind(this)}
                    onKeyUp={this.resetInactivityPeriod.bind(this)}
                >
                    <FlashMessages />
                    <ActivateFeaturesSideEffect />
                    <BypassChecklistBlockModeSideEffect
                        enabled={this.state.isBypassChecklistBlockMode}
                        disable={this.disableBypassChecklistBlockMode.bind(this)}
                    />
                    {this.renderTranslationModal()}
                    <Div100Vh
                        className="reader-layout"
                        asMinHeight={true}
                    >
                        {shouldDisplayToolbar && (
                            <Toolbar
                                collapsed={this.state.toolbarCollapsed}
                                downloadPdf={this.onPdfDownload.bind(this)}
                                isSingleUndefinedLanguage={this.state.isSingleUndefinedLanguage}
                                isTranslating={this.state.isTranslating}
                                languageCode={this.state.languageCode}
                                onClickDownloadPdfButton={this.onPdfDownload.bind(this)}
                                onClickMachineTranslation={this.onToggleTranslationModal.bind(this)}
                                onExpand={this.showToolbar.bind(this)}
                                switchLanguage={this.switchLanguage.bind(this)}
                                toggleCommentsSidebar={this.toggleCommentsSidebar.bind(this)}
                                toggleTranslationModal={this.onToggleTranslationModal.bind(this)}
                                translatedLanguage={this.state.translatedLanguage}
                                viewableTranslations={this.state.viewableTranslations}
                            />
                        )}
                        <MediaModule
                            chunks={activeImageModule}
                            imageViewportDims={imageViewportDims}
                            setImageViewportDims={this.setImageViewportDims}
                            isLandscape={isLandscape}
                            languageCode={languageCode}
                            waitingForResize={waitingForResize}
                            windowDimensions={windowDimensions}
                            setTailSlotRef={(tailslotRef) => !this.state.tailslotRef && this.setState({ tailslotRef })}
                        />
                        <ScrollHintContextProvider>
                            <TextModule
                                accountId={accountId}
                                activeLanguageCode={languageCode}
                                binderId={binderId}
                                binderLog={binderLog}
                                checklists={checklists}
                                checklistProgressBlock={this.props.checklistProgressBlock && !this.state.isBypassChecklistBlockMode}
                                chunks={activeTextModule}
                                chunksImages={activeImageModule}
                                imageViewportDims={imageViewportDims}
                                isLandscape={isLandscape}
                                mediaModuleTailslotRef={this.state.tailslotRef}
                                onChunkChange={this.onChunkChange.bind(this)}
                                onScrollUp={this.showToolbar.bind(this)}
                                previewChunk={previewChunk}
                                translatedLanguage={translatedLanguage}
                                translatedTitle={translatedTitle}
                                translations={translations}
                                userId={userId}
                                viewable={activeViewable}
                                waitingForResize={waitingForResize}
                            />
                        </ScrollHintContextProvider>
                    </Div100Vh>
                </div>
            </ThemeProvider>
        );
    }
}

const ReaderWithHooks = withHooks(Reader, () => ({
    accountFeatures: useActiveAccountFeatures(),
    accountId: useActiveAccountId(),
    accountSettings: useActiveAccountSettings(),
    checklistProgressBlock: useIsAccountFeatureActive(FEATURE_BLOCK_CHECKLIST_PROGRESS),
    checklists: useChecklistStoreState(state => state.checklists),
    commentsSidebar: useModal(CommentsSidebar, COMMENTS_SIDEBAR_ID),
    hideRibbon: useHideRibbon(),
    isLoggedIn: useIsLoggedIn(),
    machineTranslatedLanguageCode: useQueryParam(QUERY_PARAM_MTLC),
    removeMachineTranslatedLanguageCodeQueryParam: useRemoveQueryParam(QUERY_PARAM_MTLC),
    sessionId: useTrackingStoreState(state => state.sessionId),
    showRibbon: useShowRibbon(),
    userId: useCurrentUserId(),
    waitingForResize: useWaitingForResize(),
    windowDimensions: useWindowDimensions(),
    // Zustand props
    activeViewable: useActiveViewable(),
    activeParentCollection: useBinderStoreState(state => state.activeParentCollection),
    availableTranslations: useBinderStoreState(state => state.availableTranslations),
    newerPublication: useBinderStoreState(state => state.newerPublication),
    ratingEnabled: useBinderStoreState(state => state.ratingEnabled),
    readConfirmationEnabled: useBinderStoreState(state => state.readConfirmationEnabled),
    isLandscape: useIsLandscape(),
}));
const ReaderTranslated = withTranslation()(ReaderWithHooks);
export default ReaderTranslated;