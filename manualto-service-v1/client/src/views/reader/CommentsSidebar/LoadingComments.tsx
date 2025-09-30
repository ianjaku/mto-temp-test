import CommentsLoading from "@binders/ui-kit/lib/elements/icons/CommentsLoading";
import React from "react";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const LoadingComments: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="loadingComments">
            <CommentsLoading height={"52px"}/>
            <span>{t(TK.Comments_Loading)}</span>
        </div>
    );
};