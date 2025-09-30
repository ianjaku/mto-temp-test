import ContextMenu from "@binders/ui-kit/lib/elements/contextmenu";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import React from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import deleteIcon from "@binders/ui-kit/lib/elements/icons/Delete";
import editIcon from "@binders/ui-kit/lib/elements/icons/Edit";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CommentContextMenu.styl";

export const CommentContextMenu: React.FC<{
    onEditCommentClick: () => void,
    onDeleteCommentClick: () => void,
}> = ({ onEditCommentClick, onDeleteCommentClick }) => {
    const { t } = useTranslation();
    return (
        <div className="comment-menu">
            <ContextMenu
                key={"comment-context-menu"}
                menuIconName={"more_horiz"}
                menuIconStyle={{ color: "inherit", fontSize: "18px" }}
                menuStyle={{ padding: "0px" }}
            >
                <MenuItem
                    onClick={onEditCommentClick}
                    title={t(TK.General_Edit)}
                    tooltip={t(TK.General_Edit)}
                    icon={editIcon({ fontSize: "16px" })}
                />
                <MenuItem
                    onClick={onDeleteCommentClick}
                    title={t(TK.General_Delete)}
                    tooltip={t(TK.General_Delete)}
                    icon={deleteIcon({ fontSize: "16px" })}
                />
            </ContextMenu>
        </div>
    );
};