import * as React from "react";
import { Editor } from "@tiptap/react";
import { FC } from "react";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./NicheOptionsMenu.styl";

export const NicheOptionsMenu: FC<{ editor: Editor, requestClose: () => void }> = ({ editor, requestClose }) => {
    const { t } = useTranslation();

    const clickOutsideRef = useOutsideClick<HTMLDivElement>(requestClose);

    return (
        <div className="nicheoptions" ref={clickOutsideRef}>
            <span className="nicheoptions-title">
                {t(TK.Edit_NicheOptions_Title)}
            </span>
            <div className="nicheoptions-buttons">
                <button
                    aria-label={t(TK.Edit_Italic)}
                    className={cx("nicheoptions-button", { "nicheoptions-button--isActive": editor.isActive("italic") })}
                    onClick={() => {
                        editor.chain().toggleItalic().run();
                        editor.view.focus();
                    }}>
                    <Icon name="format_italic" />
                    <span>{t(TK.Edit_Italic)}</span>
                </button>
                <button
                    aria-label={t(TK.Edit_Underline)}
                    className={cx("nicheoptions-button", { "nicheoptions-button--isActive": editor.isActive("underline") })}
                    onClick={() => {
                        editor.chain().toggleUnderline().run();
                        editor.view.focus();
                    }}>
                    <Icon name="format_underline" />
                    <span>{t(TK.Edit_Underline)}</span>
                </button>
                <button
                    aria-label={t(TK.Edit_ClearFormatting)}
                    className="nicheoptions-button"
                    onClick={() => {
                        editor.chain().clearNodes().unsetAllMarks().run();
                        editor.view.focus();
                    }}>
                    <Icon name="format_clear" />
                    <span>{t(TK.Edit_ClearFormatting)}</span>
                </button>
            </div>
        </div >
    );
}
