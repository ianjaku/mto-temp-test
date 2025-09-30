import * as React from "react";
import { FC, useEffect, useMemo, useState } from "react";
import { BlockStylesDropdown } from "./BlockStyleDropdown";
import BoldIcon from "@binders/ui-kit/lib/elements/icons/Bold";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { LinkEditor } from "./LinkEditor";
import LinkIcon from "@binders/ui-kit/lib/elements/icons/Link";
import { NicheOptionsMenu } from "./NicheOptionsMenu";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { TextEditorFloater } from "../TextEditorFloater";
import cx from "classnames";
import { isIOSSafari } from "@binders/client/lib/react/helpers/browserHelper";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useCurrentEditor } from "@tiptap/react";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ToolBar.styl";

export const ToolBar: FC<{
    isChunkFocused: boolean,
    selectionBump?: number,
}> = ({ isChunkFocused, selectionBump }) => {
    const editorContext = useCurrentEditor();
    const editor = useMemo(() => editorContext.editor, [editorContext]);
    const { t } = useTranslation();
    const [linkEditorVisible, setLinkEditorVisible] = useState(false);
    const [nicheOptionsVisible, setNicheOptionsVisible] = useState(false);

    const featuresNicheOptions = useLaunchDarklyFlagValue(LDFlags.TIPTAP_NICHE_EDITING_OPTIONS);

    useEffect(() => {
        if (!editor) return () => { };
        if (isChunkFocused === false && !editor.state.selection.empty) {
            setLinkEditorVisible(false);
            editor.commands.setTextSelection({ from: 0, to: 0 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, isChunkFocused]);  // editor.commands dep makes the page run oom

    if (!editor || !isChunkFocused) return null;

    return (
        <TextEditorFloater
            editor={editor}
            tippyOptions={{
                duration: 100,
                appendTo: document.body,
                zIndex: 1399,
                placement: isMobileView() && !isIOSSafari() ? "bottom" : "top",
            }}
            pluginKey="default"
        >
            <div className="text-editor-tool-bar-area">
                <div className="text-editor-tool-bar-main" role="toolbar">
                    <BlockStylesDropdown editor={editor} selectionBump={selectionBump} />
                    <div className="text-editor-tool-bar-separator" />
                    <button
                        aria-label={t(TK.Edit_TextEditorToolBarBold)}
                        className={cx("text-editor-tool-bar-main-button", editor.isActive("bold") && "active")}
                        onClick={() => {
                            editor.chain().toggleBold().run();
                            editor.view.focus();
                        }}>
                        <BoldIcon />
                    </button>
                    <button
                        aria-label={"Link"}
                        className={cx("text-editor-tool-bar-main-button", editor.isActive("link") && "active")}
                        onClick={() => {
                            setLinkEditorVisible(v => !v);
                        }}>
                        <LinkIcon />
                    </button>
                    {featuresNicheOptions && (
                        <button
                            aria-label={t(TK.Edit_NicheOptions_Title)}
                            className="text-editor-tool-bar-main-button"
                            onClick={() => {
                                if (!nicheOptionsVisible) {
                                    setNicheOptionsVisible(true);
                                }
                            }}>
                            <Icon name="more_horiz" />
                        </button>
                    )}
                </div>
                {linkEditorVisible && (
                    <div className="text-editor-tool-bar-link" role="toolbar">
                        <LinkEditor editor={editor} requestClose={() => setLinkEditorVisible(false)} />
                    </div>
                )}
                {nicheOptionsVisible && (
                    <div className="text-editor-tool-bar-nicheoptions" role="toolbar">
                        <NicheOptionsMenu editor={editor} requestClose={() => setNicheOptionsVisible(false)} />
                    </div>
                )}
            </div>
        </TextEditorFloater>
    )
};
