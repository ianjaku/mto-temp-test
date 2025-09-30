import * as React from "react";
import { EditDocumentButton } from "./EditDocumentButton";
import { FC } from "react";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { ToolbarActions } from "./ToolbarActions";
import { ToolbarLanguage } from "./ToolbarLanguage";
import { ToolbarNavigation } from "./ToolbarNavigation";
import type { ToolbarProps } from "./types";
import cx from "classnames";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useCanEditCurrentDocument } from "../../../helpers/hooks/useAmIEditor";
import { useToolbar } from "./useToolbar";
import "./toolbar.styl";

export const Toolbar: FC<ToolbarProps> = (props) => {
    const canEdit = useCanEditCurrentDocument();
    const {
        actionsExpansion,
        closeButtonVisibility,
        collapse,
        editButtonVisibility,
        expandActionsButtonVisibility,
        languageToolbarExpansion,
        languageToolbarVisibility,
        navigationExpansion,
        setActionsExpansion,
        setLanguageToolbarExpansion,
    } = useToolbar({ ...props, canEdit, isMobileView: isMobileView() });

    const isMachineTranslated = !!props.translatedLanguage;

    return (
        <div className={cx(
            "toolbar",
            { "toolbar--collapsed": props.collapsed },
        )}>
            <div className="toolbar-trigger" onClick={props.onExpand}>
                <Icon name="menu" />
            </div>
            <div className="toolbar-interface">
                <ToolbarLanguage
                    activeLanguageCode={props.languageCode}
                    invisible={languageToolbarVisibility === "hidden"}
                    isCollapsed={languageToolbarExpansion === "collapsed"}
                    isTranslating={props.isTranslating}
                    onClickMachineTranslation={props.toggleTranslationModal}
                    setCollapsed={b => setLanguageToolbarExpansion(b ? "collapsed" : "expanded")}
                    switchLanguage={props.switchLanguage}
                    translatedLanguage={props.translatedLanguage}
                    viewableTranslations={props.viewableTranslations}
                />
                {expandActionsButtonVisibility === "visible" && <div
                    className={cx(
                        "toolbar-closebutton toolbar-closebutton--visible",
                    )}
                    onClick={() => setActionsExpansion("expanded")}
                >
                    <Icon name="more_horiz" />
                </div>}
                <ToolbarActions
                    activeLanguageCode={props.languageCode}
                    translatedLanguage={props.translatedLanguage}
                    onClickDownloadPdfButton={props.downloadPdf}
                    toggleCommentsSidebar={props.toggleCommentsSidebar}
                    invisible={actionsExpansion === "collapsed"}
                />
                <ToolbarNavigation
                    invisible={navigationExpansion === "collapsed"}
                />
                <EditDocumentButton
                    canEdit={canEdit}
                    isMinimal={isMobileView()}
                    linkToDefaultLanguage={isMachineTranslated}
                    invisible={editButtonVisibility === "hidden"}
                />
                <div
                    className={cx(
                        "toolbar-closebutton",
                        { "toolbar-closebutton--visible": closeButtonVisibility === "visible" }
                    )}
                    onClick={collapse}
                >
                    <Icon name="close" />
                </div>
            </div>
        </div>
    )
}
