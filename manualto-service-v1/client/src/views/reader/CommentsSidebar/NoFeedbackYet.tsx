import NoComments from "@binders/ui-kit/lib/elements/icons/NoComments";
import React from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

const NoFeedbackYet: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="noFeedbackYet">
            <div className="noFeedbackYet-icon">
                <NoComments height={"52px"} />
            </div>
            <div className="noFeedbackYet-title">
                {t(TK.Comments_NoFeedbackYet_Title)}
            </div>
            <div className="noFeedbackYet-info">
                {t(TK.Comments_NoFeedbackYet_Info)}
            </div>
        </div>
    );
}

export default NoFeedbackYet;