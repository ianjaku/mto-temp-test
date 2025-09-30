import * as React from "react";
import { useCallback, useState } from "react";
import { IRecursiveAction } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Input from "@binders/ui-kit/lib/elements/input";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useEffect } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";

import "./ConfirmationQuestion.styl";

interface IProps {
    recursiveAction: IRecursiveAction;
    affectedItemsCount: number;
    onChangeIsValid: (isValid: boolean) => void;
}

const ConfirmationQuestion: React.FC<IProps> = ({ recursiveAction, affectedItemsCount, onChangeIsValid }) => {

    const [val, setVal] = useState("");
    const { t } = useTranslation();

    useEffect(() => {
        onChangeIsValid(val === `${affectedItemsCount}`);
    }, [val, affectedItemsCount, onChangeIsValid]);

    useEffect(() => {
        if (!recursiveAction.requiresExplicitConfirmation) {
            onChangeIsValid(true);
        }
    }, [recursiveAction.requiresExplicitConfirmation, onChangeIsValid]);

    const renderExplicitConfirmation = useCallback(() => {
        return (
            <div className="confirmationQuestion">
                <label>
                    {t(TK.Edit_RecursiveDeleteConfirmMsgInput)}
                </label>
                <Input
                    type="text"
                    name="explicitconfirmation"
                    value={val}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(val: any) => setVal(val)}
                    width={100}
                />
            </div>
        )
    }, [val, setVal, t]);

    const renderLabel = useCallback(() => {
        return (
            <div>
                <label>
                    {t(TK.General_ConfirmProceed)}
                </label>
            </div>
        )
    }, [t]);

    return recursiveAction.requiresExplicitConfirmation ?
        renderExplicitConfirmation() :
        renderLabel();

}

export default ConfirmationQuestion;
