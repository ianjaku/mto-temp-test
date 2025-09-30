import * as React from "react";
import Binder, { curriedUpdateBinder } from "@binders/client/lib/binders/custom/class";
import { ComposerContextType, useComposerContext } from "../contexts/composerContext";
import {
    FEATURE_COMMENTING_IN_EDITOR,
    FEATURE_DIALECTS,
    FEATURE_GHENTIAN_DIALECT,
    FEATURE_HISTORY_PANE,
    FEATURE_READER_COMMENTING,
    FEATURE_READER_RATING,
    IFeature
} from "@binders/client/lib/clients/accountservice/v1/contract";
import MediaPane, { MediaPaneUsage } from "../../../media/MediaPane";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { deleteTranslation, patchImageEditProps } from "../../actions/editing";
import { unpublishBinder, updatePublicationsLanguages } from "../../actions";
import Button from "@binders/ui-kit/lib/elements/button";
import { CommentContextProvider } from "./CommentsPane/CommentContext";
import { CommentsPane } from "./CommentsPane";
import ContextMenu from "@binders/ui-kit/lib/elements/contextmenu";
import Drawer from "@binders/ui-kit/lib/elements/drawer";
import { FeedbackPane } from "./FeedbackPane";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import { FlashMessages } from "../../../logging/FlashMessages";
import HistoryPane from "../components/HistoryPane";
import { IPermissionFlag } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import Icon from "@binders/ui-kit/lib/elements/icons";
import LanguageCodeSelector from "./SettingsPane/LanguageCodeSelector";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import Modal from "@binders/ui-kit/lib/elements/modal";
import Pane from "@binders/ui-kit/lib/elements/rightPane";
import PaneItem from "@binders/ui-kit/lib/elements/rightPane/item";
import { PublicationFindResult } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { SelectedChunkDetails } from "./BinderLanguage/Chunk";
import { SetStateBinderFn } from "../hooks/useStateBinder";
import SettingsPane from "../components/SettingsPane";
import SharePane from "../components/SharePane";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { all } from "ramda";
import autobind from "class-autobind";
import { buildTranslatorLanguageCodes } from "../helpers/authorization";
import colors from "@binders/ui-kit/lib/variables";
import cx from "classnames";
import { deleteSemanticLinks } from "./SemanticLinkManager/actions";
import { getLanguageElements } from "../../../browsing/tsHelpers";
import { getLanguageInfo } from "@binders/client/lib/languages/helper";
import { patchBreadCrumbsBinder } from "../../../browsing/actions";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./NavigationDrawer.styl";

export type NavigationDrawerProps = {
    accountFeatures: string[];
    accountId: string;
    binder: Binder;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    breadcrumbsPaths?: any;
    checkApprovals: (languageCode: string) => boolean;
    clickedVisualId: string;
    domain: string;
    imageModuleKey: string;
    isDisabledView: boolean;
    isMobile: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meta: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modalPlaceholder: any;
    mostUsedLanguages: string[];
    onAddLanguage: (languageCode: string) => void;
    onDeleteLanguage: (languageCode: string, callback: () => void) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDoubleClickVisual?: (visual: any) => void;
    onRelabelLanguage: (fromLang: string, toLang: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReplaceVisual: (patch: any, affectedChunkIndices: number[]) => void;
    onShowSecondaryLanguage: (languageCode: string) => void;
    permissionFlags: IPermissionFlag[];
    primaryLanguageCode: string;
    publicationLocations: string[];
    publications: PublicationFindResult[];
    readerLocation: string;
    secondaryLanguageCode?: string;
    selectedChunkDetails: SelectedChunkDetails;
    semanticLinks: ISemanticLink[];
    setStateBinder: SetStateBinderFn;
    showShowLanguages: boolean;
    t: TFunction,
    useLogo: boolean;

    // Provided by withHooks
    composerContext: ComposerContextType;
}

export type NavigationDrawerState = {
    addLanguageDropdownVisible: boolean;
    addLanguageMenuVisible: boolean;
    binderLanguageCodes: string[];
    historyPaneLoaded: boolean;
    isDeletingLanguage: boolean;
    languageIconHovering: boolean;
    publicationFacingRemoval: { id: string, title: string, isPublished: boolean } | null;
    translatorLanguageCodes: string[];
}

export enum NavigationDrawerPaneItem {
    AddLanguagePane = 0,
    MediaPane = 1,
    PublishingPane = 2,
    SharePane = 3,
    HistoryPane = 4,
    CommentsPane = 5,
}

export const doubleClickDebounceTime = 250;
class NavigationDrawer extends React.Component<NavigationDrawerProps, NavigationDrawerState> {

    languageMenuAnchor: Element = null;
    addLanguageTooltip: Tooltip;
    commentsTooltip: Tooltip;
    historyTooltip: Tooltip;
    mediaTooltip: Tooltip;
    feedbackTooltip: Tooltip;
    settingsTooltip: Tooltip;
    shareTooltip: Tooltip;

    static getDerivedStateFromProps(_nextProps: NavigationDrawerProps, prevState: NavigationDrawerState) {
        return prevState;
    }

    constructor(props: NavigationDrawerProps) {
        super(props);
        autobind(this);
        this.state = {
            addLanguageDropdownVisible: false,
            addLanguageMenuVisible: false,
            binderLanguageCodes: undefined,
            historyPaneLoaded: false,
            isDeletingLanguage: false,
            languageIconHovering: false,
            publicationFacingRemoval: undefined,
            translatorLanguageCodes: [],
        };
    }

    async componentDidMount() {
        const { permissionFlags, binder } = this.props;
        this.setState({
            binderLanguageCodes: binder.getVisibleLanguages().map(l => l.iso639_1),
            translatorLanguageCodes: buildTranslatorLanguageCodes(permissionFlags),
        });
    }

    async componentDidUpdate(prevProps: NavigationDrawerProps) {
        const {
            binder: prevBinder,
            isMobile: prevIsMobile,
            permissionFlags: prevPermissionFlags,
        } = prevProps;
        const { binder, isMobile, permissionFlags } = this.props;
        if (prevPermissionFlags !== permissionFlags) {
            this.setState({
                translatorLanguageCodes: buildTranslatorLanguageCodes(permissionFlags),
            });
        }
        if (prevBinder !== binder) {
            this.setState({
                binderLanguageCodes: binder.getVisibleLanguages().map(l => l.iso639_1),
            });
        }
        if (prevIsMobile != isMobile) {
            this.props.composerContext.setNavigationDrawerItem(null);
        }
    }

    componentWillUnmount() {
        this.hideAllTooltips();
    }

    hasFeature(feature: IFeature) {
        return (this.props.accountFeatures || []).includes(feature);
    }

    showDeleteModal(id: string, title: string, isPublished: boolean) {
        this.setState({
            publicationFacingRemoval: { id, title, isPublished },
        });
    }

    cancelDelete() {
        this.setState({
            publicationFacingRemoval: undefined,
        });
    }

    async deleteLanguage() {
        const { binder, setStateBinder, onDeleteLanguage, primaryLanguageCode } = this.props;
        const languageCode = this.state.publicationFacingRemoval.id;
        this.setState({
            isDeletingLanguage: true,
        });


        if (this.state.publicationFacingRemoval.isPublished) {
            await unpublishBinder(binder.id, [languageCode]);
        }

        const promises = [
            deleteSemanticLinks({ binderId: binder.id, languageCode }, binder.id, true),
        ];

        if (primaryLanguageCode === languageCode) {
            const newPrimaryLanguageCode = binder.getFirstLanguage(languageCode).iso639_1;
            const newLanguageOrder = binder.getVisibleLanguages()
                .filter(({ iso639_1 }) => iso639_1 !== languageCode)
                .map(({ iso639_1 }) => iso639_1);
            promises.push(updatePublicationsLanguages(binder, newPrimaryLanguageCode, newLanguageOrder));
        }
        await Promise.all(promises);

        const patch = () => deleteTranslation(binder, languageCode);
        onDeleteLanguage(languageCode,
            () => {
                setStateBinder(curriedUpdateBinder(patch, false), patchBreadCrumbsBinder);
                this.setState({
                    publicationFacingRemoval: undefined,
                    isDeletingLanguage: false,
                });
            }
        );
    }

    showLanguageDropdown(e: React.MouseEvent) {
        e.stopPropagation();
        this.setState({ addLanguageMenuVisible: true }, () => {
            this.setState({ addLanguageDropdownVisible: !this.state.addLanguageDropdownVisible });
        });
    }

    onAddLanguage(languageCode: string) {
        if (!languageCode) {
            return;
        }
        const { binder, primaryLanguageCode, onAddLanguage, onRelabelLanguage, t } = this.props;
        this.setState({
            addLanguageMenuVisible: false,
            addLanguageDropdownVisible: false,
        });
        const visibleLanguages = binder.getVisibleLanguages().slice();
        if ((visibleLanguages || []).some(lang => lang.iso639_1 === languageCode)) {
            FlashMessages.error(t(TK.Edit_LangAlreadySelected));
            return;
        }
        if (primaryLanguageCode !== UNDEFINED_LANG) {
            onAddLanguage(languageCode);
        } else {
            onRelabelLanguage(UNDEFINED_LANG, languageCode);
        }
    }

    pickTooltip(iconName: string) {
        return {
            "comments": this.commentsTooltip,
            "history": this.historyTooltip,
            "image": this.mediaTooltip,
            "language": this.settingsTooltip,
            "share": this.shareTooltip,
            "star": this.feedbackTooltip,
            "translate": this.addLanguageTooltip,
        }[iconName];
    }

    showTranslateToolTip(e, sourceIcon) {
        this.setState({
            languageIconHovering: true
        })
        this.showTooltip(e, sourceIcon);
    }

    hideTranslateToolTip(e, sourceIcon: string) {
        this.setState({
            languageIconHovering: false
        })
        this.hideTooltip(e, sourceIcon);
    }

    showTooltip(e, sourceIcon) {
        showTooltip(e, this.pickTooltip(sourceIcon), TooltipPosition.LEFT);
    }

    hideTooltip(e, sourceIcon) {
        hideTooltip(e, this.pickTooltip(sourceIcon));
    }

    hideAllTooltips() {
        this.hideTooltip(undefined, "comments");
        this.hideTooltip(undefined, "image");
        this.hideTooltip(undefined, "insert_chart");
        this.hideTooltip(undefined, "language");
        this.hideTooltip(undefined, "star");
        this.hideTooltip(undefined, "share");
        this.hideTooltip(undefined, "translate");
    }

    onAddLanguageMenuClick() {
        this.setState({
            addLanguageMenuVisible: !this.state.addLanguageMenuVisible,
            addLanguageDropdownVisible: false,
        });
    }

    onOpenHistoryPaneDrawer() {
        this.setState({
            historyPaneLoaded: true
        });
    }

    buildLanguageMenuItems(languages) {
        const { t } = this.props;

        return languages.map(language => (
            <MenuItem
                key={language.iso639_1}
                onClick={() => {
                    this.setState({
                        addLanguageMenuVisible: false,
                    })
                    this.props.onShowSecondaryLanguage(language)
                }
                }
                title={t(TK.Edit_LangShow, { language: language.name })}
                className="add-language-menu-item" />
        ));
    }

    onUpdateVisual(visualId: string, imageModuleKey: string, props: unknown) {
        const { binder, setStateBinder } = this.props;
        const moduleIndex = binder.getImagesModuleIndex(imageModuleKey);
        const patch = () => patchImageEditProps(binder, moduleIndex, visualId, props);
        setStateBinder(curriedUpdateBinder(patch, true), undefined, undefined, false, true);
    }

    calculateLanguageIconColor(isDisabled: boolean) {
        if (isDisabled) {
            return colors.disabledColor;
        }
        return this.state.languageIconHovering ? colors.accentColor : colors.whiteColor;
    }

    renderAddLanguagesPaneItem() {
        const { primaryLanguageCode, isDisabledView, mostUsedLanguages, binder, onRelabelLanguage } = this.props;
        const { translatorLanguageCodes } = this.state;
        const items = this.renderShowLanguageMenuItems().filter(i => !!i);
        const isDisabled =
            isDisabledView ||
            (!!translatorLanguageCodes && (primaryLanguageCode === UNDEFINED_LANG || items.length === 0));
        const color = this.calculateLanguageIconColor(isDisabled);
        if (isDisabled) {
            return (
                <>
                    <label className={cx("composer-panes-languageIcon", "composer-panes-languageIcon--disabled")}>
                        <Icon name="translate" />
                    </label>
                </>
            );
        }
        if (primaryLanguageCode === UNDEFINED_LANG) {
            return (
                <>
                    <div ref={ref => this.languageMenuAnchor = ref} />
                    <LanguageCodeSelector
                        languageCode={UNDEFINED_LANG}
                        onSelectLanguageCode={(languageCode) => onRelabelLanguage(UNDEFINED_LANG, languageCode)}
                        mostUsedLanguages={mostUsedLanguages}
                        binder={binder}
                        featuresDialects={this.hasFeature(FEATURE_DIALECTS)}
                        translatorLanguageCodes={translatorLanguageCodes}
                        languageMenuAnchor={this.languageMenuAnchor}
                        iconName="translate"
                        iconClassname="composer-panes-languageIcon"
                        topNudge={30}
                        changeLanguageNoticeTK={TK.Edit_LangSetNotice}
                    />
                </>
            )
        }
        return (
            <ContextMenu
                key="add-languages-contextmenu"
                buttonClass="add-languages-contextmenu-button"
                className="add-languages-contextmenu"
                onClick={this.onAddLanguageMenuClick}
                menuIconName={"translate"}
                menuIconStyle={{
                    fontSize: 26,
                    color,
                }}
                handleMouseEnter={this.showTranslateToolTip}
                handleMouseLeave={this.hideTranslateToolTip}
                menuStyle={{ width: 40, padding: 0, height: 40, }}
                open={this.state.addLanguageMenuVisible}
                isDisabled={isDisabled}
            >
                {items}
            </ContextMenu>
        );
    }

    renderMediaPaneItem() {
        const {
            binder,
            imageModuleKey,
            modalPlaceholder,
            onReplaceVisual,
            selectedChunkDetails,
            onDoubleClickVisual,
            t,
            isDisabledView
        } = this.props;

        const { translatorLanguageCodes } = this.state;
        const isDisabled = !!translatorLanguageCodes || isDisabledView;
        return (
            <PaneItem
                className={"composer-panes-mediaIcon"}
                iconName={"image"}
                handleIconMouseEnter={this.showTooltip}
                handleIconMouseLeave={this.hideTooltip}
                isDisabled={isDisabled}
            >
                <Drawer title={t(TK.Visual_Title)} className="composer-panes-media">
                    <MediaPane
                        binder={binder}
                        selectedVisualId={this.props.clickedVisualId}
                        imageModuleKey={imageModuleKey}
                        modalPlaceholder={modalPlaceholder}
                        onUpdateVisual={this.onUpdateVisual}
                        onReplaceVisual={onReplaceVisual}
                        selectedChunkDetails={selectedChunkDetails}
                        onDoubleClickVisual={onDoubleClickVisual}
                        usage={MediaPaneUsage.Composer}
                    />
                </Drawer>
            </PaneItem>
        )
    }

    renderPublishingPaneItem() {
        const {
            binder,
            breadcrumbsPaths,
            modalPlaceholder,
            readerLocation,
            semanticLinks,
            meta,
            checkApprovals,
            t,
            setStateBinder,
            permissionFlags,
            publicationLocations,
            isDisabledView,
            onRelabelLanguage,
        } = this.props;
        const { translatorLanguageCodes } = this.state;
        return (
            <PaneItem
                className="publishing-menu-item"
                iconName={"language"}
                handleIconMouseEnter={this.showTooltip}
                handleIconMouseLeave={this.hideTooltip}
                isDisabled={isDisabledView}
            >
                <Drawer title={t(TK.Edit_Publishing)}>
                    <SettingsPane
                        binder={binder}
                        breadcrumbsPaths={breadcrumbsPaths}
                        cancelDelete={this.cancelDelete}
                        showDeleteModal={this.showDeleteModal}
                        setStateBinder={setStateBinder}
                        publicationLocations={publicationLocations}
                        readerLocation={readerLocation}
                        semanticLinks={semanticLinks}
                        modalPlaceholder={modalPlaceholder}
                        meta={meta}
                        checkApprovals={checkApprovals}
                        translatorLanguageCodes={translatorLanguageCodes}
                        permissionFlags={permissionFlags}
                        onRelabelLanguage={onRelabelLanguage}
                    />
                </Drawer>
            </PaneItem>
        );
    }

    renderSharePaneItem() {
        const { binder, t, isDisabledView } = this.props;
        return (
            <PaneItem
                iconName={"share"}
                handleIconMouseEnter={this.showTooltip}
                handleIconMouseLeave={this.hideTooltip}
                isDisabled={isDisabledView}
            >
                <Drawer title={t(TK.DocManagement_ShareTitle)}>
                    <SharePane
                        binder={binder}
                    />
                </Drawer>
            </PaneItem>
        )
    }

    maybeRenderCommentsPaneItem() {
        const { accountFeatures, binder, isDisabledView, primaryLanguageCode, secondaryLanguageCode, selectedChunkDetails, t } = this.props;
        const readerCommenting = accountFeatures?.includes(FEATURE_READER_COMMENTING);
        const editorCommenting = accountFeatures?.includes(FEATURE_COMMENTING_IN_EDITOR);
        if (!readerCommenting && !editorCommenting) {
            return null;
        }
        return (
            <PaneItem
                className="comments-pane-item"
                iconName="comments"
                handleIconMouseEnter={this.showTooltip}
                handleIconMouseLeave={this.hideTooltip}
                isDisabled={isDisabledView}
            >
                <Drawer title={t(TK.Edit_Comment, { count: 2 })}>
                    <CommentContextProvider
                        binder={binder}
                        selectedChunkDetails={selectedChunkDetails}
                        primaryLanguageCode={primaryLanguageCode}
                        secondaryLanguageCode={secondaryLanguageCode}
                    >
                        <CommentsPane
                            binderId={binder.id}
                            readerCommenting={readerCommenting}
                            editorCommenting={editorCommenting}
                        />
                    </CommentContextProvider>
                </Drawer>
            </PaneItem>
        )
    }

    maybeRenderFeedbackPaneItem() {
        const { accountFeatures, binder, isDisabledView, t } = this.props;
        const readerRating = accountFeatures?.includes(FEATURE_READER_RATING);
        if (!readerRating) {
            return null;
        }
        return (
            <PaneItem
                className="ratings-pane-item"
                iconName="star"
                handleIconMouseEnter={this.showTooltip}
                handleIconMouseLeave={this.hideTooltip}
                isDisabled={isDisabledView}
            >
                <Drawer title={t(TK.ReaderFeedback_Setting_Rating)}>
                    <FeedbackPane binder={binder} />
                </Drawer>
            </PaneItem>
        )
    }

    maybeRenderHistoryPaneItem() {
        const { binder, domain, t, isDisabledView } = this.props;
        const { historyPaneLoaded } = this.state;
        if (!(this.hasFeature(FEATURE_HISTORY_PANE))) {
            return null;
        }
        return (
            <PaneItem
                iconName={"history"}
                handleIconMouseEnter={this.showTooltip}
                handleIconMouseLeave={this.hideTooltip}
                isDisabled={isDisabledView}
            >
                <Drawer title={t(TK.Edit_HistoryTitle)} onOpen={this.onOpenHistoryPaneDrawer} className="history-drawer">
                    {historyPaneLoaded && (
                        <HistoryPane
                            binderId={binder.id}
                            domain={domain}
                        />
                    )}
                </Drawer>
            </PaneItem>
        )
    }

    renderShowLanguageMenuItems() {
        const { primaryLanguageCode, binder, showShowLanguages } = this.props;
        if (!binder) {
            return;
        }
        const { addLanguageDropdownVisible } = this.state;
        if (addLanguageDropdownVisible) {
            return [
                this.renderAddLanguageMenuItem()
            ]
        }
        const languages = binder.getVisibleLanguages().slice();
        const languageIndex = languages.findIndex(l => l.iso639_1 === primaryLanguageCode);
        languages.splice(languageIndex, 1);
        const languageMenuItems = showShowLanguages && !addLanguageDropdownVisible ? this.buildLanguageMenuItems(languages) : [];
        return languageMenuItems.concat(
            [
                ...(languageMenuItems.length > 0 ? [<hr key="hr" style={{ backgroundColor: colors.borderGrayColor, height: 1, border: 0 }} />] : []),
                this.renderAddLanguageMenuItem()
            ]
        );
    }

    renderAddLanguageMenuItem() {
        const { primaryLanguageCode, t } = this.props;
        const { binderLanguageCodes, translatorLanguageCodes } = this.state;
        if (translatorLanguageCodes && (all(lc => binderLanguageCodes.includes(lc), translatorLanguageCodes) || primaryLanguageCode === UNDEFINED_LANG)) {
            return null;
        }
        return (
            <MenuItem
                key="new"
                onClick={this.showLanguageDropdown}
                title={t(TK.Edit_LangAddNew)}
                persistent={true}
                className="add-language-menu-item"
            />
        );
    }

    render() {
        const {
            binder,
            isMobile,
            mostUsedLanguages,
            t,
            composerContext
        } = this.props;
        const {
            addLanguageDropdownVisible,
            publicationFacingRemoval,
            translatorLanguageCodes,
        } = this.state;

        const visibleLanguages = binder && binder.getVisibleLanguages();
        const languageCodesToDisable = visibleLanguages.map(l => l.iso639_1);
        const languagesToDisableSet = new Set(languageCodesToDisable ?? []);
        const languageCodesToPrioritize = (mostUsedLanguages ?? []).filter(l => !languagesToDisableSet.has(l));
        const { elements: languageDropdownElements, prioritizedCount } = getLanguageElements({
            languageCodesToPrioritize,
            languageCodesToDisable,
            languageCodesToDisableSuffix: ` (${t(TK.Edit_LangAlreadyAdded)})`,
            includeDialects: this.hasFeature(FEATURE_DIALECTS),
            includeGhentianDialect: this.hasFeature(FEATURE_GHENTIAN_DIALECT),
            translatorLanguageCodes,
        });

        return isMobile ?
            null :
            (
                <div>
                    <Pane
                        onClick={index => {
                            // Close the pane if the same pane is already open
                            if (composerContext.navigationDrawerItem === index) {
                                composerContext.setNavigationDrawerItem(null)
                            } else {
                                composerContext.setNavigationDrawerItem(index)
                            }
                        }}
                        onClose={() => composerContext.setNavigationDrawerItem(null)}
                        index={composerContext.navigationDrawerItem ?? -1}
                        ribbonsTopHeight={0}
                    >
                        {/* Should match "NavigationDrawerPaneItem" */}
                        {this.renderAddLanguagesPaneItem()}
                        {this.renderMediaPaneItem()}
                        {this.renderPublishingPaneItem()}
                        {this.renderSharePaneItem()}
                        {this.maybeRenderHistoryPaneItem()}
                        {this.maybeRenderCommentsPaneItem()}
                        {this.maybeRenderFeedbackPaneItem()}
                    </Pane>
                    {publicationFacingRemoval && (
                        <Modal
                            title={t(TK.Edit_LangRemove)}
                            onHide={this.cancelDelete}
                            buttons={[
                                <Button key="cancel" text={t(TK.General_Cancel)} secondary={true} onClick={this.cancelDelete} />,
                                <Button
                                    key="ok"
                                    text={t(TK.General_Ok)}
                                    onClick={this.deleteLanguage}
                                    inactiveWithLoader={this.state.isDeletingLanguage}
                                />
                            ]}
                            hidden={false}
                            onEnterKey={this.deleteLanguage}
                            onEscapeKey={this.cancelDelete}
                        >
                            <div className="settingsPane-modal">
                                {
                                    publicationFacingRemoval.isPublished ?
                                        <div>
                                            <p>{t(TK.Edit_PubRemoveInfo1)}</p>
                                            <p>{t(TK.Edit_PubRemoveInfo2, { language: getLanguageInfo(this.state.publicationFacingRemoval.id).name, publication: this.state.publicationFacingRemoval.title })}</p>
                                            <p>{t(TK.General_ConfirmProceed)}</p>
                                        </div> :
                                        <p>
                                            {t(TK.Edit_PubRemoveConfirm, { language: getLanguageInfo(this.state.publicationFacingRemoval.id).name, publication: this.state.publicationFacingRemoval.title })}
                                        </p>
                                }
                            </div>
                        </Modal>
                    )}
                    <Tooltip ref={ref => { this.addLanguageTooltip = ref; }} message={t(TK.General_Languages)} />
                    <Tooltip ref={ref => { this.mediaTooltip = ref; }} message={t(TK.Visual_Title)} />
                    <Tooltip ref={ref => { this.settingsTooltip = ref; }} message={t(TK.Edit_Publishing)} />
                    <Tooltip ref={ref => { this.shareTooltip = ref; }} message={t(TK.DocManagement_ShareTitle)} />
                    <Tooltip ref={ref => { this.historyTooltip = ref; }} message={t(TK.Edit_HistoryTitle)} />
                    <Tooltip ref={ref => { this.commentsTooltip = ref; }} message={t(TK.Edit_Comment, { count: 2 })} />
                    <Tooltip ref={ref => { this.feedbackTooltip = ref; }} message={t(TK.ReaderFeedback_Setting_Rating)} />
                    {addLanguageDropdownVisible && languageDropdownElements.length > 0 && (
                        <FilterableDropdown
                            key="add-languages-dropdown"
                            type={t(TK.General_Languages)}
                            className="add-languages-dropdown"
                            elements={languageDropdownElements}
                            horizontalRulePositions={prioritizedCount ? [prioritizedCount] : []}
                            onSelectElement={this.onAddLanguage}
                            maxRows={7}
                            defaultOpened={true}
                            keepOpen={true}
                        />
                    )}
                </div>
            );
    }
}

const NavigationDrawerWithHooks = withHooks(NavigationDrawer, () => ({
    composerContext: useComposerContext()
}));
export default withTranslation()(NavigationDrawerWithHooks);
