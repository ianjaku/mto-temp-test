import * as React from "react";
import { EditorEvent, captureFrontendEvent, stringifyEventProperties } from "@binders/client/lib/thirdparty/tracking/capture";
import {
    FEATURE_APPROVAL_FLOW,
    FEATURE_DIALECTS,
    FEATURE_MANUALTO_CHUNK,
    FEATURE_NOCDN,
    FEATURE_PDF_EXPORT
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import {
    getDocumentPath,
    pdfExport,
    pdfPreview,
    publishBinder,
    unpublishBinder
} from "../../../actions";
import { updateLanguageOrder, updateMetaPDFExportOptions } from "../../../actions/editing";
import AccountStore from "../../../../accounts/store";
import BinderStore from "../../../store";
import Button from "@binders/ui-kit/lib/elements/button";
import { Container } from "flux/utils";
import { FlashMessages } from "../../../../logging/FlashMessages";
import InfoOutline from "@binders/ui-kit/lib/elements/icons/InfoOutline";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { NoVideoFormatsError } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import SettingsRow from "./SettingsRow";
import Slider from "@binders/ui-kit/lib/elements/slider";
import Sortable from "@binders/ui-kit/lib/elements/sortable";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Toggle from "@binders/ui-kit/lib/elements/toggle/Toggle";
import { WebDataComponent } from "@binders/ui-kit/lib/elements/webdata";
import autobind from "class-autobind";
import { buildLink } from "@binders/client/lib/binders/readerPath";
import colors from "@binders/ui-kit/lib/variables";
import { createPortal } from "react-dom";
import { curriedUpdateBinder, } from "@binders/client/lib/binders/custom/class";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { flagsContainPermissions } from "../../../../authorization/tsHelpers";
import { fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import hasDraft from "@binders/client/lib/util/hasDraft";
import { patchBreadCrumbsBinder } from "../../../../browsing/actions";
import { reorder } from "@binders/client/lib/dnd/helpers";
import { updatePublicationsLanguages } from "../../../actions";
import { withProtocol } from "@binders/client/lib/util/uri";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./SettingsPane.styl";

class SettingsPane extends WebDataComponent {

    static getStores() {
        return [AccountStore, BinderStore];
    }

    static calculateState(prevState) {

        return {
            data: WebData.compose({
                publications: BinderStore.getActiveBinderPublications(),
                accountFeatures: AccountStore.getAccountFeatures(),
            }),
            accountSettings: AccountStore.getAccountSettings(),
            activeAccount: AccountStore.getActiveAccountId(),
            domains: AccountStore.getDomains(),
            exportOptions: prevState?.exportOptions ?? SettingsPane.initialExportOptions,
            publicationToExport: prevState ? prevState.publicationToExport : null,
            fontsMultiplier: prevState && prevState.exportOptions ?
                prevState.exportOptions.fontsSize.paragraph / SettingsPane.initialExportOptions.fontsSize.paragraph :
                1.0,
            exportingPublication: false,
            mostUsedLanguages: BinderStore.getMostUsedLanguages(),
        };
    }

    static getPDFExportOptions() {
        const accountSettings = AccountStore.getAccountSettings();
        if (accountSettings.status === WebDataState.SUCCESS) {
            const { data } = accountSettings;
            return data.pdfExport || {};
        }
        return {};
    }

    static initialExportOptions = {
        renderTitlePage: true,
        renderOnlyFirstCarrouselItem: SettingsPane.getPDFExportOptions().renderOnlyFirstCarrouselItem,
        fontsSize: {
            h1: 32,
            h2: 24,
            h3: 19,
            paragraph: 16,
            dateLabel: 12,
            li: 12,
        }
    }

    /* HOOKS */

    constructor(props) {
        super(props);
        autobind(this, SettingsPane.prototype);
        this.state = {};
    }

    /* HELPER FUNCTIONS */
    sortLanguagesByPriority(l1, l2) {
        if (l1.priority !== undefined && l2.priority !== undefined) {
            return l1.priority - l2.priority;
        }
        if (l1.priority === undefined && l2.priority !== undefined) {
            return 1;
        }
        if (l1.priority !== undefined && l2.priority === undefined) {
            return -1;
        }
        return 0;
    }

    buildOnReorder(publications) {
        return async (startIndex, endIndex) => {
            const { binder, setStateBinder } = this.props;
            const languageCodes = binder
                .getVisibleLanguages()
                .sort(this.sortLanguagesByPriority)
                .map(language => language.iso639_1);
            const reorderedLanguageCodes = reorder(languageCodes, startIndex, endIndex);
            const masterLanguageCode = reorderedLanguageCodes.find(languageCode => {
                return (
                    publications
                        .filter(p => p.isActive)
                        .map(p => p.language.iso639_1)
                        .indexOf(languageCode) >= 0
                );
            });
            const patch = updateLanguageOrder(binder, reorderedLanguageCodes);
            setStateBinder(curriedUpdateBinder(() => [patch], false), patchBreadCrumbsBinder);
            await updatePublicationsLanguages(binder, masterLanguageCode, reorderedLanguageCodes);
        }
    }

    onShowDeleteModal(id, title, isPublished) {
        this.props.showDeleteModal(id, title, isPublished);
    }

    onPublishLanguage(languageCode) {
        publishBinder(this.props.binder.id, [languageCode]);
    }

    downloadBlob(blob, filename) {
        if (window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveBlob(blob, filename);
        } else {
            const link = document.createElement("a");
            link.href = window.URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }
    }

    async onPdfExport() {
        const { binder, t } = this.props;
        const { domains, publicationToExport, exportOptions, data: { partials: { accountFeatures: accountFeaturesWD } } } = this.state;
        const featuresCDN = !(accountFeaturesWD.result.includes(FEATURE_NOCDN));
        const shouldRenderAdditionalChunk = accountFeaturesWD.result.includes(FEATURE_MANUALTO_CHUNK);

        const domain = [...domains.result].pop();
        try {
            this.onCancelPdfExport();
            this.setState({ exportingPublication: publicationToExport.id });
            const pdfExportOptions = { ...exportOptions, cdnnify: featuresCDN, shouldRenderAdditionalChunk }
            const buffer = await pdfExport(publicationToExport.id, domain, pdfExportOptions);
            const blob = new Blob([new Uint8Array(buffer.data)]);
            this.downloadBlob(blob, `${publicationToExport.title}_${fmtDateIso8601TZ(new Date())}.pdf`);
            captureFrontendEvent(EditorEvent.BinderPdfExport, stringifyEventProperties({
                ...pdfExportOptions,
                binderId: binder.id,
                publicationId: publicationToExport.id,
            }));
        }
        catch (err) {
            // eslint-disable-next-line
            console.error(err);
            if (err.errorDetails && err.errorDetails.name === NoVideoFormatsError.NAME) {
                FlashMessages.error(t(TK.Visual_VideoStillTranscodingLong));
            } else {
                FlashMessages.error(t(TK.Edit_PdfCreateError));
            }
        }
        finally {
            updateMetaPDFExportOptions(
                binder,
                publicationToExport.languageCode,
                exportOptions,
            );
            this.setState({ exportingPublication: false });
        }
    }

    onUnpublishLanguage(languageCode) {
        const { binder: { id } } = this.props;
        unpublishBinder(id, [languageCode]);
    }

    onRequestPdfExport(publicationToExportId, publicationToExportTitle, languageCode) {
        const { binder } = this.props;
        const metaModuleIndex = binder.getMetaModuleIndexByLanguageCode(languageCode);
        const meta = binder.modules.meta[metaModuleIndex];
        const exportOptions = meta.pdfExportOptions || SettingsPane.initialExportOptions;

        this.setState({
            publicationToExport: {
                title: publicationToExportTitle,
                id: publicationToExportId,
                languageCode,
            },
            exportOptions,
            fontsMultiplier: !meta.pdfExportOptions ?
                1.0 :
                meta.pdfExportOptions.fontsSize.paragraph / SettingsPane.initialExportOptions.fontsSize.paragraph,
        });
    }

    onCancelPdfExport() {
        this.setState({ publicationToExport: null });
    }

    async onPdfPreview() {
        const { domains, publicationToExport, exportOptions, data: { partials: { accountFeatures: accountFeaturesWD } } } = this.state;
        const { binder, t } = this.props;
        const featuresCDN = !(accountFeaturesWD.result.includes(FEATURE_NOCDN));
        const shouldRenderAdditionalChunk = accountFeaturesWD.result.includes(FEATURE_MANUALTO_CHUNK);
        const domain = [...domains.result].pop();
        this.setState({ loadingPreview: true });
        try {
            const pdfPreviewHtml = await pdfPreview(publicationToExport.id, domain, { ...exportOptions, cdnnify: featuresCDN, shouldRenderAdditionalChunk });
            this.setState({ pdfPreviewHtml });
            captureFrontendEvent(EditorEvent.BinderPdfPreview, { binderId: binder.id });

        } catch (error) {
            if (error.errorDetails && error.errorDetails.name === NoVideoFormatsError.NAME) {
                FlashMessages.error(t(TK.Visual_VideoStillTranscodingLong));
            }
        } finally {
            this.setState({ loadingPreview: false });
        }
    }

    onToggleTitlePage() {
        const { exportOptions } = this.state;
        this.setState({
            exportOptions: {
                ...exportOptions,
                renderTitlePage: !exportOptions.renderTitlePage,
            }
        });
    }

    onToggleFirstVisualInCarousel() {
        const { exportOptions } = this.state;
        this.setState({
            exportOptions: {
                ...exportOptions,
                renderOnlyFirstCarrouselItem: !exportOptions.renderOnlyFirstCarrouselItem,
            }
        });
    }

    onChangeFontsMultiplier(fontsMultiplier) {
        const exportOptions = {
            ...this.state.exportOptions,
            fontsSize: {
                h1: 32 * fontsMultiplier,
                h2: 24 * fontsMultiplier,
                h3: 19 * fontsMultiplier,
                paragraph: 16 * fontsMultiplier,
                dateLabel: 12 * fontsMultiplier,
                li: 12 * fontsMultiplier,
            }
        }
        this.setState({ fontsMultiplier, exportOptions });
    }

    onHidePreviewModal() {
        this.setState({ pdfPreviewHtml: false });
    }

    writeContent(frame) {
        const { pdfPreviewHtml } = this.state;
        if (!frame) {
            return;
        }
        frame.contentWindow.contents = pdfPreviewHtml;
        // eslint-disable-next-line no-script-url
        frame.src = "javascript:window['contents']";
    }

    /* RENDERS */

    renderPdfPreviewWindow() {
        const { pdfPreviewHtml } = this.state;
        const { modalPlaceholder, t } = this.props;

        return !pdfPreviewHtml ?
            null :
            createPortal((
                <Modal title="print-preview" classNames="export-pdf-previewModal" onHide={this.onHidePreviewModal.bind(this)}>
                    <iframe
                        width={1235}
                        height={680}
                        title={t(TK.Edit_PdfPreview)}
                        src='about:blank'
                        ref={this.writeContent.bind(this)}
                    />
                </Modal>
            ), modalPlaceholder);
    }

    renderPdfExportModal() {
        const {
            publicationToExport,
            exportOptions,
            fontsMultiplier,
            loadingPreview,
        } = this.state;
        const { renderTitlePage, renderOnlyFirstCarrouselItem } = exportOptions;
        const { modalPlaceholder, t } = this.props;

        if (!publicationToExport) {
            return null;
        }

        const previewLabel = loadingPreview ? `${t(TK.General_Loading)}...` : t(TK.Edit_Preview);
        const modalButtons = [
            <Button key="cancel" text={t(TK.General_Cancel)} secondary onClick={this.onCancelPdfExport.bind(this)} />,
            <Button key="preview" text={previewLabel} secondary onClick={this.onPdfPreview.bind(this)} />,
            <Button key="ok" text={t(TK.Edit_Export)} onClick={this.onPdfExport.bind(this)} />,
        ]
        return createPortal(
            (
                <Modal
                    title={t(TK.Edit_PdfCreateTitle)}
                    buttons={modalButtons}
                    onHide={this.onCancelPdfExport.bind(this)}
                    classNames="export-publication-pdf-modal"
                >
                    <div className="export-pdf-modal-body">
                        <div className="export-pdf-modal-row">
                            <span>{t(TK.Edit_PdfPrefTitlePage)}</span>
                            <Toggle
                                isToggled={renderTitlePage}
                                onToggle={this.onToggleTitlePage.bind(this)}
                            />
                        </div>
                        <div className="export-pdf-modal-row">
                            <span>{t(TK.Edit_PdfPrefOneVisualChunk)}</span>
                            <Toggle
                                isToggled={renderOnlyFirstCarrouselItem}
                                onToggle={this.onToggleFirstVisualInCarousel.bind(this)}
                            />
                        </div>
                        <div className="export-pdf-modal-row">
                            <span>{t(TK.Edit_FontSize)}:</span>
                            <span>{Math.floor(fontsMultiplier * 100)}%</span>
                        </div>
                        <div className="export-pdf-modal-row">
                            <Slider
                                min={0.3}
                                step={0.1}
                                max={3.0}
                                value={fontsMultiplier}
                                onChange={this.onChangeFontsMultiplier.bind(this)}
                            />
                        </div>
                    </div>
                </Modal>
            ), modalPlaceholder);
    }


    render() {
        return this.renderWebData(this.state.data);
    }

    renderSuccess(data) {
        const { t } = this.props;
        const { accountFeatures } = data;
        const featuresPdfExport = accountFeatures.includes(FEATURE_PDF_EXPORT);
        const featuresApprovalFlow = accountFeatures.includes(FEATURE_APPROVAL_FLOW);
        const sortedLangs = this.props.binder.getVisibleLanguages()
            .sort(this.sortLanguagesByPriority);
        const hasSomeActivePublication = data.publications.some(pub => pub.isActive);

        return (
            <>
                <div className="settingsPane-langMenuAnchor" ref={ref => { this.languageMenuAnchor = ref }} />
                <div className="settingsPane-container">
                    {this.renderPdfPreviewWindow()}
                    {this.renderPdfExportModal()}
                    <div className="settingsPane-publishInfo">
                        {this.renderPublishInfo()}
                    </div>
                    <div className="settingsPane-header">
                        <div className="settingsPane-header-action">{t(TK.Edit_View).toUpperCase()}</div>
                        {featuresPdfExport && hasSomeActivePublication && (
                            <div className="settingsPane-header-action">{t(TK.Edit_Export).toUpperCase()}</div>
                        )}
                        <div className="settingsPane-header-action">{t(TK.General_Delete_Short).toUpperCase()}</div>
                        <div className="settingsPane-header-action">{t(TK.Edit_Publish).toUpperCase()}</div>
                    </div>
                    <div className="settingsPane-table">
                        <Sortable onReorder={this.buildOnReorder(data.publications).bind(this)}>
                            {sortedLangs.map((language, index) =>
                                this.renderLanguageRow(
                                    language,
                                    index,
                                    data,
                                    sortedLangs.length > 1,
                                    featuresPdfExport,
                                    featuresApprovalFlow
                                )
                            )}
                        </Sortable>
                    </div>

                </div>
            </>
        )
    }

    renderPublishInfo() {
        const { publicationLocations, t } = this.props;
        return publicationLocations && publicationLocations.length > 1 ?
            (
                <div>
                    <div className="settingsPane-publishInfo-header">
                        <div className="settingsPane-publishInfo-header-icon">
                            {InfoOutline({ color: colors.accentColor, fontSize: 20 })}
                        </div>
                        <div className="settingsPane-publishInfo-header-label">
                            <label>
                                {t(TK.Edit_PublishInfo)}:
                            </label>
                        </div>
                    </div>
                    <ul className="settingsPane-publishInfo-list">
                        {publicationLocations.map((loc, i) => <li key={`publoc${i}`}>{loc}</li>)}
                    </ul>
                </div>
            ) :
            "";
    }

    renderLanguageRow(language, index, data, showDragHandle, featuresPdfExport, featuresApprovalFlow) {
        const {
            meta,
            readerLocation,
            semanticLinks,
            checkApprovals,
            translatorLanguageCodes,
            permissionFlags,
            onRelabelLanguage,
        } = this.props;
        const { domains, mostUsedLanguages } = this.state;
        const { publications, accountFeatures } = data;
        const { binder, breadcrumbsPaths, draggableElement } = this.props;
        const publication = publications.find(pub => pub.language.iso639_1 === language.iso639_1);
        const isPublished = publication !== undefined;
        const allChunksForLanguageApproved = checkApprovals(language.iso639_1);
        const isMaster = publications.find(p => {
            return p.language.iso639_1 === language.iso639_1 && p.isMaster;
        });
        const isLanguageDeletable = binder.modules.meta
            .filter(metaModule => (metaModule.type === "text" && !metaModule.isDeleted))
            .length > 1;
        const hasDrafts = hasDraft(meta, language.iso639_1, publications);
        const domain = [...domains.result].pop();
        const launchConfig = {
            isCollection: false,
            lang: language.iso639_1,
            itemId: binder.id,
            parentCollections: getDocumentPath(breadcrumbsPaths),
            semanticLinks,
            domain,
            readerLocation,
        };
        const launchLink = withProtocol(buildLink(launchConfig));
        const previewLink = withProtocol(buildLink({ ...launchConfig, semanticLinks: [], isDraft: true }));

        const isReadOnly = !!translatorLanguageCodes && !(translatorLanguageCodes.includes(language.iso639_1));
        const isTranslatorLanguage = !!translatorLanguageCodes && (translatorLanguageCodes.includes(language.iso639_1));


        const hasPublishPermissionForLanguage = flagsContainPermissions(
            permissionFlags,
            [PermissionName.PUBLISH],
            { languageCode: language.iso639_1 }
        )

        return (
            <SettingsRow
                launchLink={launchLink}
                previewLink={previewLink}
                publish={this.onPublishLanguage.bind(this)}
                unpublish={this.onUnpublishLanguage.bind(this)}
                hasDrafts={hasDrafts}
                onDelete={this.onShowDeleteModal.bind(this)}
                isPublished={isPublished}
                isDeletable={isLanguageDeletable}
                key={language.iso639_1}
                allChunksApproved={allChunksForLanguageApproved}
                languageCode={language.iso639_1}
                title={language.storyTitle}
                index={index}
                featuresPdfExport={featuresPdfExport}
                featuresApprovalFlow={featuresApprovalFlow}
                featuresDialects={accountFeatures.includes(FEATURE_DIALECTS)}
                onPdfExport={this.onRequestPdfExport.bind(this)}
                isMaster={isMaster !== undefined}
                draggableElement={draggableElement}
                showDragHandle={showDragHandle && !translatorLanguageCodes}
                publicationId={publication && publication.id}
                hasActivePublication={publication && publication.isActive}
                hasOtherActivePublications={publications.some(pub => pub.isActive)}
                exportingPublication={this.state.exportingPublication}
                hasPublishPermission={hasPublishPermissionForLanguage}
                isReadOnly={isReadOnly}
                isTranslatorLanguage={isTranslatorLanguage}
                binder={binder}
                mostUsedLanguages={mostUsedLanguages}
                translatorLanguageCodes={translatorLanguageCodes}
                languageMenuAnchor={this.languageMenuAnchor}
                onRelabelLanguage={onRelabelLanguage}
            />
        );
    }

    renderFailure(error) {
        return FlashMessages.error(this.props.t(TK.DocManagement_CantLodDocumentSettings, { error: error.message }))
    }
}

const container = Container.create(fixES5FluxContainer(SettingsPane));
export default withTranslation()(container);
