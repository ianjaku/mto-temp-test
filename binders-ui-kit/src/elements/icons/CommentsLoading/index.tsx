import Icon from "../../../../public/icons/loading-comments.svg";
import React from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

const CommentsLoading: React.FC<{
    width?: string;
    height?: string;
    onClick?: (e: React.MouseEvent) => void;
}> = ({ width, height, onClick }) => {
    const { t } = useTranslation();
    return (
        <img
            onClick={e => onClick?.(e)}
            style={{width, height}}
            src={Icon}
            alt={t(TK.Comments_Loading)}
        />
    );
}

export default CommentsLoading;