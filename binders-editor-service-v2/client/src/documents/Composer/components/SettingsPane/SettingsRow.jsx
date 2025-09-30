import * as React from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from  "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import DeleteButton from "@binders/ui-kit/lib/elements/button/DeleteButton";
import DragIndicator from "@binders/ui-kit/lib/elements/icons/DragIndicator";
import { FlashMessages } from "../../../../logging/FlashMessages";
import LanguageCodeSelector from "./LanguageCodeSelector";
import PdfButton from "@binders/ui-kit/lib/elements/button/PdfButton";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Toggle from "@binders/ui-kit/lib/elements/toggle/Toggle";
import ViewButton from "@binders/ui-kit/lib/elements/button/ViewButton";
import autobind from "class-autobind";
import cx from "classnames";
import settingsPaneVars from "./vars";
import vars from "@binders/ui-kit/lib/variables";
import { withTranslation } from "@binders/client/lib/react/i18n";

const dragIconStyle = {
    opacity: "0.3",
    cursor: "move",
    color: vars.whiteColor,
};

class SettingsRow extends React.Component {

    constructor(props) {
        super(props);
        autobind(this);
        this.state = {
            isHovered: false,
        };
    }

    componentDidUpdate(prevProps) {
        const { isPublished: prevIsPublished } = prevProps;
        const { isPublished } = this.props;
        if (prevIsPublished !== isPublished) {
            this.setState({
                tentativePublishedState: false,
            });
        }
    }


    /* HANDLERS */

    onMouseEnter() {
        this.setState({
            isHovered: true,
        });
    }

    onMouseLeave() {
        this.setState({
            isHovered: false,
        });
    }

    onDelete() {
        this.props.onDelete(this.props.languageCode, this.props.title, this.props.isPublished);
    }

    onToggle() {
        const { languageCode, isPublished, publish, title, unpublish, t } = this.props;
        if (title === "" && !isPublished) {
            FlashMessages.error(t(TK.Edit_PublishFailNoTitle));
            return;
        }
        if (isPublished) {
            unpublish(languageCode);
        } else {
            publish(languageCode);
        }
        this.setState({
            tentativePublishedState: isPublished ? "unpublished" : "published",
        });
    }

    onPublishDraft() {
        const { title, t } = this.props;
        if (title === "") {
            FlashMessages.error(t(TK.Edit_PublishFailNoTitle));
            return;
        }
        this.props.publish(this.props.languageCode);
    }

    async onPdfExport() {
        const { languageCode, onPdfExport, publicationId, title } = this.props;
        onPdfExport(publicationId, title, languageCode);
    }

    getPublishToggleState() {
        let isToggled;
        let isDisabled;
        const { hasPublishPermission, isPublished, featuresApprovalFlow, allChunksApproved, isReadOnly, isTranslatorLanguage } = this.props;
        const { tentativePublishedState } = this.state;

        if (isReadOnly || (!hasPublishPermission && !isTranslatorLanguage) || (featuresApprovalFlow && !allChunksApproved && !isPublished)) {
            isDisabled = true;
        }
        if (tentativePublishedState) {
            isToggled = tentativePublishedState === "published";
            isDisabled = true;
        } else {
            isToggled = isPublished;
        }
        return {
            isToggled,
            isDisabled
        }
    }

    /* RENDER */


    renderPublishTooltip(tooltipPosition, isDraftTootltip = false) {
        const { hasPublishPermission, featuresApprovalFlow, allChunksApproved, isPublished, isReadOnly, isTranslatorLanguage } = this.props;
        if (isReadOnly || (!hasPublishPermission && !isTranslatorLanguage)) {
            return (e) => showTooltip(e, this.noPublishPermissionTooltip, tooltipPosition);
        }

        const showPublishDraftTooltip = isDraftTootltip && featuresApprovalFlow && !allChunksApproved
        const showTogglePublishTooltip = featuresApprovalFlow && !allChunksApproved && !isPublished
        if (showPublishDraftTooltip || showTogglePublishTooltip) {
            return (e) => showTooltip(e, this.noPublishApprovalsTooltip, tooltipPosition);
        }
    }

    hidePublishTooltip(e) {
        hideTooltip(e, this.noPublishApprovalsTooltip);
        hideTooltip(e, this.noPublishPermissionTooltip);
    }

    onChangeLanguageCode(toLanguageCode) {
        const { languageCode, onRelabelLanguage } = this.props;
        onRelabelLanguage(languageCode, toLanguageCode);
    }

    renderLanguageRow() {
        const {
            allChunksApproved,
            featuresApprovalFlow,
            featuresPdfExport,
            hasDrafts,
            isDeletable,
            isMaster,
            isPublished,
            languageCode,
            launchLink,
            previewLink,
            showDragHandle,
            title,
            hasPublishPermission,
            t,
            isReadOnly,
            binder,
            mostUsedLanguages,
            featuresDialects,
            translatorLanguageCodes,
            languageMenuAnchor,
            index,
        } = this.props;

        const { isHovered } = this.state;
        const { isToggled, isDisabled } = this.getPublishToggleState();
        const allowPublishDraftClick = !isReadOnly || hasPublishPermission || (hasPublishPermission && featuresApprovalFlow && allChunksApproved)
        const disablePublishDraftButton = isReadOnly || !hasPublishPermission || (featuresApprovalFlow && !allChunksApproved)
        return (
            <>
                <div className="settingsPane-table-rows"
                    onMouseEnter={this.onMouseEnter}
                    onMouseLeave={this.onMouseLeave}
                >
                    <div className="settingsPane-table-row" >
                        <div className="settingsPane-table-row-title">
                            <LanguageCodeSelector
                                languageCode={languageCode}
                                onSelectLanguageCode={this.onChangeLanguageCode}
                                isMaster={isMaster}
                                mostUsedLanguages={mostUsedLanguages}
                                binder={binder}
                                featuresDialects={featuresDialects}
                                translatorLanguageCodes={translatorLanguageCodes}
                                languageMenuAnchor={languageMenuAnchor}
                                topNudge={(settingsPaneVars.settingsTableRowHeight * index) + 90}
                                changeLanguageNoticeTK={TK.DocManagement_RelabelConfirmation}
                            />
                            <div className="settingsPane-table-row-title-text">{title.length > 0 ? title : `<${t(TK.Edit_PubEmptyTitle)}>`}</div>
                        </div>
                        <div className="settingsPane-table-row-actions">
                            <div className="settingsPane-table-row-action">
                                <a href={isPublished ? launchLink : previewLink} target="_blank" rel="noopener noreferrer">
                                    <ViewButton onClick={Function.prototype} />
                                </a>
                            </div>
                            {this.renderPdfButton()}
                            <div className="settingsPane-table-row-action"
                            >
                                <DeleteButton isDisabled={!isDeletable || isReadOnly} onClick={this.onDelete} />
                            </div>
                            <div
                                className="settingsPane-table-row-action is-last"
                                onMouseEnter={this.renderPublishTooltip(TooltipPosition.LEFT)}
                                onMouseLeave={this.hidePublishTooltip}
                            >
                                <Toggle
                                    isToggled={isToggled}
                                    onToggle={this.onToggle}
                                    isEnabled={!isDisabled}
                                    className="isPublishedToggle"
                                />
                            </div>
                        </div>
                    </div>
                    {hasDrafts && isPublished &&
                        (<div className="settingsPane-table-row">
                            <div
                                className={cx("settingsPane-table-row-draft-text", { "settingsPane-table-row-draft-text--disabled": disablePublishDraftButton })}
                                onClick={allowPublishDraftClick ? this.onPublishDraft : Function.prototype}
                                onMouseEnter={this.renderPublishTooltip(TooltipPosition.BOTTOM, true)}
                                onMouseLeave={this.hidePublishTooltip}
                            >
                                {t(TK.Edit_PublishDraft)}
                            </div>
                            <div className="settingsPane-table-row-action">
                                <a href={previewLink} target="_blank" rel="noopener noreferrer">
                                    <ViewButton onClick={Function.prototype} />
                                </a>
                            </div>
                            {
                                featuresPdfExport && (
                                    <div className="settingsPane-table-row-action" />
                                )
                            }
                            <div className="settingsPane-table-row-action" />
                            <div className="settingsPane-table-row-action" />
                        </div>)}
                </div>
                <div className="settingsPane-table-row-anchor">
                    {showDragHandle && !isReadOnly && isHovered && DragIndicator(dragIconStyle)}
                </div>
            </>
        );
    }


    renderPdfButton() {
        const {
            exportingPublication,
            featuresPdfExport,
            hasActivePublication,
            hasOtherActivePublications,
            publicationId,
        } = this.props;
        const shouldRenderButton = featuresPdfExport && hasActivePublication;
        if (featuresPdfExport && hasOtherActivePublications && !hasActivePublication) {
            return <div className="settingsPane-table-row-action" />;
        }
        const isExportingPdf = exportingPublication === publicationId;
        return shouldRenderButton && (
            <div className="settingsPane-table-row-action">
                {isExportingPdf ?
                    CircularProgress() :
                    (
                        <PdfButton onClick={this.onPdfExport} />
                    )
                }
            </div>
        )
    }

    renderTooltips() {
        return [
            <Tooltip key="no-publish-permission" ref={ref => { this.noPublishPermissionTooltip = ref; }} message={this.props.t(TK.Edit_PublishFailNoPermission)} />,
            <Tooltip key="no-publish-approvals" ref={ref => { this.noPublishApprovalsTooltip = ref; }} message={this.props.t(TK.Edit_PublishFailNoApprovals)} />,
        ];
    }

    render() {
        return (
            <div className="settingsPane-table-row-container">
                {this.renderLanguageRow()}
                {this.renderTooltips()}
            </div>
        );
    }
}

export default withTranslation()(SettingsRow);
