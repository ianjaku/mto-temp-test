import * as React from "react";
import Button from ".";
import Check from "../icons/Check";
import Close from "../icons/Close";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useMemo } = React;

interface IChecklistStatusButton {
    onClick?: (e?: React.MouseEvent<HTMLElement>) => void;
    isPerformed?: boolean;
    isInfoOnly?: boolean;
    shouldShake?: boolean;
    disabled?: boolean;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function ChecklistStatusButton(props: IChecklistStatusButton) {
    const {
        isInfoOnly,
        isPerformed,
        onClick,
        shouldShake,
        disabled
    } = props;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t }: { t: any } = useTranslation();

    const icon = useMemo(() => isPerformed || isInfoOnly ?
        Check({ marginRight: "10px" }) :
        Close({ marginRight: "10px" })
    , [isInfoOnly, isPerformed]);

    const text = useMemo(
        () => {
            if (isInfoOnly) {
                return t(TK.Edit_ChunkCheckable);
            }
            return isPerformed ?
                t(TK.Reader_ChecklistTaskPerformed) :
                t(TK.Reader_ChecklistTaskNotPerformed);
        },
        [isInfoOnly, isPerformed, t],
    );

    return (
        <Button
            isEnabled={!disabled}
            className={`checklistStatusButton ${shouldShake ? "visualFocus" : ""}`}
            text={text}
            onClick={onClick}
            icon={icon}
        />
    )
}

export default ChecklistStatusButton;