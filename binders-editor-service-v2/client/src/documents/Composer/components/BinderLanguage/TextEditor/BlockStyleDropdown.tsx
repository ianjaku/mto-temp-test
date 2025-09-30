import * as React from "react";
import { FC, useEffect } from "react";
import { H1Icon, H2Icon, H3Icon } from "@binders/ui-kit/lib/elements/icons/Heading";
import BulletListIcon from "@binders/ui-kit/lib/elements/icons/BulletList";
import DropdownArrow from "@binders/ui-kit/lib/elements/icons/DropdownArrow";
import { Editor } from "@tiptap/react";
import Icon from "@binders/ui-kit/lib/elements/icons";
import OrderedListIcon from "@binders/ui-kit/lib/elements/icons/OrderedList";
import { ParagraphIcon } from "@binders/ui-kit/lib/elements/icons/Paragraph";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { WarningOutlined } from "@binders/ui-kit/lib/elements/icons/WarningOutlined";
import cx from "classnames";
import { isMobileDevice } from "@binders/client/lib/react/helpers/browserHelper";
import { useAnimateVisibility } from "@binders/client/lib/react/helpers/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./BlockStyleDropdown.styl";

export const BlockStylesDropdown: FC<{ editor: Editor, selectionBump?: number }> = ({ editor, selectionBump }) => {
    const {
        isVisible: isDropdownVisible,
        shouldRender: shouldDropdownRender,
        setVisibility: setIsDropdownVisible,
    } = useAnimateVisibility(false, { delayMs: 0 });
    const activeBlockStyle = getActiveBlockStyle(editor);
    const { t } = useTranslation();
    
    // Close dropdown when selection changes
    useEffect(() => {
        if (selectionBump !== undefined) {
            setIsDropdownVisible(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectionBump]);

    return (
        <div className="block-styles-dropdown">

            <button
                id="menu-button"
                aria-expanded="true"
                aria-haspopup="true"
                onClick={() => setIsDropdownVisible(!isDropdownVisible)}
            >
                {t(getBlockStyleName(editor))}
                <DropdownArrow />
            </button>

            {shouldDropdownRender && <div className={cx(
                "dropdown",
                isDropdownVisible ? "dropdown__visible" : "dropdown__invisible",
                isMobileDevice() && "dropdown__mobile",
            )}>

                <span className="dropdown-section">{t(TK.Edit_TextEditorToolBarTypography)}</span>

                <button
                    className={activeBlockStyle === "paragraph" ? "active" : ""}
                    onClick={() => {
                        editor.chain().setParagraph().run();
                        editor.view.focus();
                        setIsDropdownVisible(false);
                    }}><ParagraphIcon />{t(TK.Edit_TextEditorToolBarParagraph)}</button>
                <button
                    className={activeBlockStyle === "h1" ? "active" : ""}
                    onClick={() => {
                        editor.chain().focus().clearNodes().unsetAllMarks().toggleHeading({ level: 1 }).run();
                        editor.view.focus();
                        setIsDropdownVisible(false);
                    }}><H1Icon />{t(TK.Edit_TextEditorToolBarHeading1)}</button>
                <button
                    className={activeBlockStyle === "h2" ? "active" : ""}
                    onClick={() => {
                        editor.chain().focus().clearNodes().unsetAllMarks().toggleHeading({ level: 2 }).run();
                        editor.view.focus();
                        setIsDropdownVisible(false);
                    }}><H2Icon />{t(TK.Edit_TextEditorToolBarHeading2)}</button>
                <button
                    className={activeBlockStyle === "h3" ? "active" : ""}
                    onClick={() => {
                        editor.chain().focus().clearNodes().unsetAllMarks().toggleHeading({ level: 3 }).run();
                        editor.view.focus();
                        setIsDropdownVisible(false);
                    }}><H3Icon />{t(TK.Edit_TextEditorToolBarHeading3)}</button>

                <span className="dropdown-section">{t(TK.Edit_TextEditorToolBarLists)}</span>

                <button
                    className={activeBlockStyle === "orderedList" ? "active" : ""}
                    onClick={() => {
                        editor.chain().focus().clearNodes().unsetAllMarks().toggleOrderedList().run();
                        setIsDropdownVisible(false);
                    }}><OrderedListIcon />{t(TK.Edit_TextEditorToolBarOrderedList)}</button>
                <button
                    className={activeBlockStyle === "bulletList" ? "active" : ""}
                    onClick={() => {
                        editor.chain().focus().clearNodes().unsetAllMarks().toggleBulletList().run();
                        setIsDropdownVisible(false);
                    }}><BulletListIcon />{t(TK.Edit_TextEditorToolBarBulletList)}</button>


                <span className="dropdown-section">{t(TK.Edit_TextEditorToolBarAttentionBlocks)}</span>
                <button
                    className={activeBlockStyle === "blockInfo" ? "active" : ""}
                    onClick={() => {
                        editor.chain().setBlockInfo();
                        setIsDropdownVisible(false);
                    }}><Icon name="lightbulb_outline" />{t(TK.Edit_TextEditorToolBarBlockInfo)}</button>
                <button
                    className={activeBlockStyle === "blockWarning" ? "active" : ""}
                    onClick={() => {
                        editor.chain().setBlockWarning();
                        setIsDropdownVisible(false);
                    }}><WarningOutlined />{t(TK.Edit_TextEditorToolBarBlockWarning)}</button>

            </div>}

        </div>
    )
}

type BlockStyle =
    | "paragraph"
    | "h1"
    | "h2"
    | "h3"
    | "bulletList"
    | "orderedList"
    | "blockInfo"
    | "blockWarning";

function getActiveBlockStyle(editor: Editor): BlockStyle {
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    if (editor.isActive("bulletList")) return "bulletList";
    if (editor.isActive("orderedList")) return "orderedList";
    if (editor.isActive("blockInfo")) return "blockInfo";
    if (editor.isActive("blockWarning")) return "blockWarning";
    return "paragraph";
}

function getBlockStyleName(editor: Editor): string {
    switch (getActiveBlockStyle(editor)) {
        case "paragraph":
            return TK.Edit_TextEditorToolBarParagraph;
        case "h1":
            return TK.Edit_TextEditorToolBarHeading1;
        case "h2":
            return TK.Edit_TextEditorToolBarHeading2;
        case "h3":
            return TK.Edit_TextEditorToolBarHeading3;
        case "bulletList":
            return TK.Edit_TextEditorToolBarBulletList;
        case "orderedList":
            return TK.Edit_TextEditorToolBarOrderedList;
        case "blockInfo":
            return TK.Edit_TextEditorToolBarBlockInfo;
        case "blockWarning":
            return TK.Edit_TextEditorToolBarBlockWarning;
    }
}


