import * as React from "react";
import AddCircleButton from "@binders/ui-kit/lib/elements/button/AddCircle";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useTranslation } from "@binders/client/lib/react/i18n";

interface Props {
    onClick: () => void;
}

const AddBtn: React.FC<Props> = ({
    onClick,
}) => {
    const { t } = useTranslation();

    if (isMobileView()) {
        return (
            <label className="accessBox-addBtn" onClick={onClick}>
                {t(TK.General_Add)}
            </label>
        );
    }

    return (
        <AddCircleButton
            onClick={onClick}
            tooltip={t(TK.User_AddSelected)}
        />

    )
}

export default AddBtn;