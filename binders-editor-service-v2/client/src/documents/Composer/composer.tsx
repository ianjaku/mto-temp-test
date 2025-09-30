import * as React from "react";
import { BinderLanguageDiffProvider, useBinderDiff } from "../../content/BinderDiffProvider";
import {
    BindersModuleMeta,
    DocumentCollection,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BreadcrumbsSet, extractItemFromBreadcrumbsPaths } from "../../browsing/helper";
import {
    FEATURE_DOCUMENT_OWNER,
    IAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { History, Location } from "history";
import { clearBinderVisuals, loadBinderVisuals } from "../../media/actions";
import {
    AiOptimizeContentBinderMenuButtons
} from "../../content/AiOptimizeContentBinderMenuButtons";
import AuthorsInfo from "./components/AuthorsInfo/AuthorsInfo";
import Binder from "@binders/client/lib/binders/custom/class";
import BinderBusyModal from "./components/BinderBusy";
import { BinderLanguage } from "./components/BinderLanguage";
import { BinderLanguageWithContext } from "./BinderLanguageWithContext";
import { ChunkPropsContextProvider } from "./contexts/chunkPropsContext";
import { ComposerPropsContextProvider } from "./contexts/composerPropsContext";
import DeletedItemNotification from "../../shared/DeletedItemNotification";
import DocumentComposerStats from "./components/DocumentComposerStats";
import { Droppable } from "react-beautiful-dnd";
import { ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";
import { IBinderUpdate } from "./helpers/binderUpdates";
import { ICommentsMap } from "./helpers/comments";
import { IDraggingInfo } from "./helpers/dragdrop";
import { ILockInfo } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { IPermissionFlag } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { IPreviewVisual } from "./contract";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import { LanguageSelector } from "./components/LanguageSelector";
import OwnershipInfo from "./components/OwnershipInfo";
import { ResponsiveChunk } from "./components/BinderLanguage/ResponsiveChunk";
import { SelectedChunkDetails } from "./components/BinderLanguage/Chunk";
import { SetStateBinderFn } from "./hooks/useStateBinder";
import { SharingButton } from "./components/SharingButton/SharingButton";
import { StoreVisual } from "../../media/binder-media-store";
import TranslatorNewLangModal from "./components/TranslatorNewLangModal";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { buildSingleCollectionParentItemsMap } from "../../trash/helpers";
import { buildTranslatorLanguageCodes } from "./helpers/authorization";
import cx from "classnames";
import { getLanguageInfo } from "@binders/client/lib/languages/helper";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import hasDraft from "@binders/client/lib/util/hasDraft";
import { useCallback } from "react";
import { useComposerContext } from "./contexts/composerContext";
import useInitialComposerView from "./hooks/useInitialComposerView";
import { useWindowDimensions } from "@binders/ui-kit/lib/hooks/useWindowDimensions";
import vars from "@binders/ui-kit/lib/variables";
import "./composer.styl";

const { useMemo, useEffect } = React;

export interface IComposerProps {
    accountFeatures: string[];
    accountId: string;
    accountSettings: IAccountSettings;
    accountUsers: User[];
    binder: Binder;
    binderVisuals: StoreVisual[];
    breadcrumbsPaths?: DocumentCollection[][];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browseContext?: any;
    canIAdmin?: boolean;
    commentDrafts?: ICommentsMap;
    domain: string;
    draggingInfo?: IDraggingInfo;
    commentThreads: ExtendedCommentThread[];
    featuresChecklists: boolean;
    hideSecondaryLanguage: () => void;
    history: History;
    isDisabledView?: boolean;
    isMobile: boolean;
    location: Location;
    lockedByInfo: ILockInfo;
    meta: BindersModuleMeta[];
    mobileViewOnOpenRightPane: boolean;
    modalPlaceholder: HTMLElement;
    mostUsedLanguages: string[];
    onAddLanguage: (languageCode: string) => void;
    onBinderUpdate: (binderUpdate: IBinderUpdate) => void;
    onOverrideLock: () => void;
    permissionFlags?: IPermissionFlag[];
    previewVisuals: IPreviewVisual[];
    primaryLanguageCode: string | undefined;
    publications: Publication[];
    redirectUserBack: (disallowReleaseLock: boolean) => void;
    secondaryLanguageCode: string | undefined;
    selectedChunkDetails: SelectedChunkDetails;
    semanticLinks: ISemanticLink[];
    setPrimaryLanguageCode: (code: string) => void;
    setSecondaryLanguageCode: (code: string) => void;
    setSelectedChunkDetails: (i: SelectedChunkDetails) => void;
    setStateBinder: SetStateBinderFn;
    useLogo: boolean;
}

const Composer = (props: IComposerProps): React.ReactElement => {
    const {
        accountFeatures,
        binder,
        breadcrumbsPaths,
        canIAdmin,
        hideSecondaryLanguage,
        isDisabledView,
        isMobile,
        location,
        lockedByInfo,
        meta,
        mobileViewOnOpenRightPane,
        modalPlaceholder,
        onAddLanguage,
        onOverrideLock,
        permissionFlags = [],
        primaryLanguageCode,
        publications,
        redirectUserBack,
        secondaryLanguageCode,
        setPrimaryLanguageCode,
        setSecondaryLanguageCode,
        setSelectedChunkDetails,
        setStateBinder,
    } = props;

    const hideBreadcrumbsContextMenu = false;
    const inCompose = true;
    const showMyLibraryLink = true;

    const [translatorNewLangModalVisibility, setTranslatorNewLangModalVisibility] = React.useState(false);
    const translatorLanguageCodes = useMemo(() => buildTranslatorLanguageCodes(permissionFlags), [permissionFlags]);

    const visibleLanguages = useMemo(() => binder.getVisibleLanguages(), [binder]);
    useEffect(() => {
        const chunkParam = getQueryStringVariable("chunk", location.search) || "-1";
        setSelectedChunkDetails({ index: parseInt(chunkParam, 10), isPrimary: true });
    }, [location.search, setSelectedChunkDetails]);

    const { setCanAdmin, disableChunkPointerEvents, setHasHorizontalVisuals } = useComposerContext();

    const { binderDiff, binderDiffObj } = useBinderDiff();

    useEffect(() => {
        setCanAdmin(canIAdmin);
    }, [canIAdmin, setCanAdmin]);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loadBinderVisuals(binder as any);
        return () => clearBinderVisuals();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useInitialComposerView(
        binder,
        setPrimaryLanguageCode,
        setSecondaryLanguageCode,
        translatorLanguageCodes,
        setTranslatorNewLangModalVisibility,
    );

    const windowDimensions = useWindowDimensions();
    const hasHorizontalVisuals = useMemo(
        () => isMobile || mobileViewOnOpenRightPane || windowDimensions.width < parseInt(vars.laptop, 10),
        [isMobile, mobileViewOnOpenRightPane, windowDimensions]
    );

    useEffect(() => {
        setHasHorizontalVisuals(hasHorizontalVisuals);
    }, [hasHorizontalVisuals, setHasHorizontalVisuals]);

    const hideTranslatorAddNewLangModal = useCallback(() => {
        setTranslatorNewLangModalVisibility(false);
    }, [setTranslatorNewLangModalVisibility])

    const renderTitleChunks = () => {
        return [primaryLanguageCode, secondaryLanguageCode]
            .filter(l => !!l)
            .map((languageCode, index: number) => {
                const isPrimary = primaryLanguageCode === languageCode;
                const readonlyMode = !!translatorLanguageCodes && !(translatorLanguageCodes.includes(languageCode));
                const languagesForDropdown = visibleLanguages.filter(l => l.iso639_1 !== (isPrimary ? secondaryLanguageCode : primaryLanguageCode));
                const changeLanguage = isPrimary ? setPrimaryLanguageCode : setSecondaryLanguageCode
                const isInTranslationView = !!secondaryLanguageCode;
                return (
                    <BinderLanguageDiffProvider
                        key={`binder-language-${languageCode}-${index}`}
                        languageCode={languageCode}
                    >
                        <BinderLanguageWithContext
                            binder={binder}
                            setStateBinder={setStateBinder}
                            hasDraft={hasDraft(meta, languageCode, publications)}
                            hasPublications={!!publications.find(p => p.language.iso639_1 === languageCode)}
                            index={index}
                            isInDiffView={false}
                            isInTranslationView={isInTranslationView}
                            isPrimary={isPrimary}
                            languageCode={languageCode}
                            setPrimaryLanguageCode={setPrimaryLanguageCode}
                            setSecondaryLanguageCode={setSecondaryLanguageCode}
                            primaryLanguageCode={primaryLanguageCode}
                            secondaryLanguageCode={secondaryLanguageCode}
                            translatorLanguageCodes={translatorLanguageCodes}
                            visibleLanguages={visibleLanguages}
                        >
                            <div className={cx(
                                `grid-col-${index + 1}`,
                                "grid-row-1",
                                "flex flex-row",
                                secondaryLanguageCode && (isPrimary ? "pe-2" : "ps-2"),
                            )}>
                                {!isInTranslationView && <AiOptimizeContentBinderMenuButtons
                                    binderObj={binder}
                                    langIdx={binder.getLanguageIndex(languageCode)}
                                />}
                                <LanguageSelector
                                    hasCloseButton={!isPrimary}
                                    languageCode={languageCode}
                                    languages={languagesForDropdown}
                                    onClose={hideSecondaryLanguage}
                                    onSelectLanguageCode={changeLanguage}
                                    readonlyMode={readonlyMode || isDisabledView}
                                    selectedLanguageCode={languageCode}
                                />
                            </div>
                            <div className={`grid-col-${index + 1} grid-row-2`}>
                                <ChunkPropsContextProvider props={{ index: -1 }}>
                                    <ResponsiveChunk className="binderlanguage-title" />
                                </ChunkPropsContextProvider>
                            </div>
                        </BinderLanguageWithContext>
                    </BinderLanguageDiffProvider>
                );
            })
    }

    const renderBinderDiff = () => {
        if (!binder || breadcrumbsPaths.length === 0) {
            return undefined;
        }
        if (!binderDiff) return undefined;
        const gridTemplateColumns = "minmax(0, 1fr) minmax(0, 1fr)";
        const binders = [binder, binderDiffObj].filter(b => !!b);

        return (
            <Droppable droppableId="chunks" type="chunk">
                {(provided) => (
                    <div
                        className={cx("binder-languages", { "isMobile": isMobile })}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                            gridTemplateColumns,
                            msGridColumns: gridTemplateColumns,
                        }}
                    >
                        {
                            binders.map((binder, index: number) => {
                                return (
                                    <BinderLanguageDiffProvider
                                        key={`binder-diff-${index}`}
                                        languageCode={primaryLanguageCode}
                                    >
                                        <BinderLanguageWithContext
                                            binder={binder}
                                            setStateBinder={setStateBinder}
                                            hasDraft={hasDraft(meta, primaryLanguageCode, publications)}
                                            hasPublications={!!publications.find(p => p.language.iso639_1 === primaryLanguageCode)}
                                            index={index}
                                            isInDiffView
                                            isInTranslationView={false}
                                            isPrimary={index === 0}
                                            languageCode={primaryLanguageCode}
                                            setPrimaryLanguageCode={setPrimaryLanguageCode}
                                            setSecondaryLanguageCode={setSecondaryLanguageCode}
                                            primaryLanguageCode={primaryLanguageCode}
                                            secondaryLanguageCode={"xx"}
                                            translatorLanguageCodes={translatorLanguageCodes}
                                            visibleLanguages={visibleLanguages}
                                        >
                                            <BinderLanguage />
                                            {provided.placeholder}
                                        </BinderLanguageWithContext>
                                    </BinderLanguageDiffProvider>
                                )
                            })
                        }
                    </div >
                )}
            </Droppable >
        );
    }

    const renderBinderLanguages = () => {
        if (!visibleLanguages || !binder || breadcrumbsPaths.length === 0) {
            return undefined;
        }
        if (binderDiff) return undefined;

        const gridTemplateColumns = `minmax(0, 1fr)${secondaryLanguageCode ? " minmax(0, 1fr)" : ""}`;

        const languageCodes = [primaryLanguageCode, secondaryLanguageCode].filter(lc => !!lc);

        return (
            <Droppable droppableId="chunks" type="chunk">
                {(provided) => (
                    <div
                        className={cx("binder-languages", { "isMobile": isMobile })}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                            gridTemplateColumns,
                            msGridColumns: gridTemplateColumns,
                        }}
                    >
                        {languageCodes.map((languageCode, index: number) => {
                            return (
                                <BinderLanguageDiffProvider
                                    key={`binder-language-${languageCode}-${index}`}
                                    languageCode={languageCode}
                                >
                                    <BinderLanguageWithContext
                                        binder={binder}
                                        setStateBinder={setStateBinder}
                                        hasDraft={hasDraft(meta, languageCode, publications)}
                                        hasPublications={!!publications.find(p => p.language.iso639_1 === languageCode)}
                                        index={index}
                                        isInDiffView={false}
                                        isInTranslationView={!!secondaryLanguageCode}
                                        isPrimary={primaryLanguageCode === languageCode}
                                        languageCode={languageCode}
                                        setPrimaryLanguageCode={setPrimaryLanguageCode}
                                        setSecondaryLanguageCode={setSecondaryLanguageCode}
                                        primaryLanguageCode={primaryLanguageCode}
                                        secondaryLanguageCode={secondaryLanguageCode}
                                        translatorLanguageCodes={translatorLanguageCodes}
                                        visibleLanguages={visibleLanguages}
                                    >
                                        <BinderLanguage />
                                        {provided.placeholder}
                                    </BinderLanguageWithContext>
                                </BinderLanguageDiffProvider>
                            )
                        })}
                    </div>
                )}
            </Droppable>
        );
    };

    const maybeRenderDeletedNotification = useCallback(() => {
        if (!binder.isDeleted()) {
            return null;
        }
        const binderObj = binder.toJSON();
        return (
            <DeletedItemNotification
                isTranslatorMode={!!translatorLanguageCodes}
                item={binderObj}
                parentItemsMap={buildSingleCollectionParentItemsMap(
                    binderObj.id,
                    [...breadcrumbsPaths].pop(),
                )}
            />
        )
    }, [binder, breadcrumbsPaths, translatorLanguageCodes]);

    const [firstPath] = [...breadcrumbsPaths[0]].reverse();
    const activeItemId = firstPath && firstPath.id;
    const activeItem = activeItemId && extractItemFromBreadcrumbsPaths(breadcrumbsPaths, activeItemId);
    const autoWidth = "composer-auto-width--wide";

    return (
        <ComposerPropsContextProvider props={props}>
            <div className="composer-top-bar">
                <div className={cx(
                    "composer-top-bar-inner container-inner",
                    autoWidth,
                )}>
                    <div className={cx(
                        "composer-top-bar--head",
                        "breadcrumbs-viewer",
                    )}>
                        <div className="breadcrumbs-wrapper">
                            <BreadcrumbsSet
                                breadcrumbsPaths={breadcrumbsPaths}
                                activeItem={activeItem}
                                isForActive={true}
                                history={props.history}
                                modalPlaceholder={modalPlaceholder}
                                inCompose={inCompose}
                                showMyLibraryLink={showMyLibraryLink}
                                hideBreadcrumbsContextMenu={hideBreadcrumbsContextMenu}
                                hideMyLibrary={false}
                                hideRootCollection
                            />
                        </div>
                        <div className="composer-top-bar--stats">
                            <DocumentComposerStats binder={binder} />
                        </div>
                    </div>
                    <div className="composer-top-bar--tail">
                        {accountFeatures.includes(FEATURE_DOCUMENT_OWNER) ?
                            <OwnershipInfo binder={binder} /> :
                            <AuthorsInfo binderAuthorIds={binder.getAuthorIds()} />
                        }
                        <SharingButton
                            binder={binder}
                            initialLanguageCode={primaryLanguageCode}
                        />
                    </div>
                </div>
            </div>
            <div className="composer composer-title-chunks">
                <div className={cx(
                    "composer-auto-width",
                    "composer-title-chunks--grid",
                    secondaryLanguageCode ? "grid-cols-2" : "grid-cols-1",
                    secondaryLanguageCode ? "composer-width-90-pct" : "composer-width-75-pct",
                    { "composer--horizontalvisuals": hasHorizontalVisuals },
                )}>
                    {renderTitleChunks()}
                </div>
            </div>
            <div
                className={cx(
                    "composer",
                    "container",
                    secondaryLanguageCode ? "composer-width-90-pct" : "composer-width-75-pct",
                    { "composer--horizontalvisuals": hasHorizontalVisuals },
                    { "composer--disableChunkPointerEvents": disableChunkPointerEvents },
                )}
            >
                {maybeRenderDeletedNotification()}
                <div className="chunks-area">
                    {renderBinderLanguages()}
                    {renderBinderDiff()}
                </div>
                {!isDisabledView && (
                    <BinderBusyModal
                        lockedByInfo={lockedByInfo}
                        onOverrideLock={onOverrideLock}
                        redirectUserBack={redirectUserBack}
                    />
                )}
                {!isDisabledView && translatorNewLangModalVisibility && !!translatorLanguageCodes && (
                    <TranslatorNewLangModal
                        addTranslatorLanguage={onAddLanguage}
                        languageCode={translatorLanguageCodes[0]}
                        languageInfo={getLanguageInfo(translatorLanguageCodes[0])}
                        onHide={hideTranslatorAddNewLangModal}
                    />
                )}
            </div>
        </ComposerPropsContextProvider>
    )
}

export default Composer;
