import * as React from "react";
import { useBinderDiff, useBinderLanguageDiff } from "../../../../content/BinderDiffProvider";
import Button from "@binders/ui-kit/lib/elements/button";
import Check from "@binders/ui-kit/lib/elements/icons/Check";
import Close from "@binders/ui-kit/lib/elements/icons/Close";
import { FC } from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useBinderLanguageComputedProps } from "../../contexts/binderLanguagePropsContext";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const BinderDiffViewControls: FC<{
    gridColumn: number;
    gridRow: number;
}> = ({ gridRow }) => {
    const { binderDiffStateMap } = useBinderDiff();
    const { langIdx } = useBinderLanguageComputedProps();
    const { closeDiffView } = useBinderLanguageDiff();
    const { t } = useTranslation();
    const hasDiffChanges = Object.keys(binderDiffStateMap[langIdx] ?? {}).length > 0;
    return (
        <div
            className="binderDiffControls"
            style={{ gridRow }}
        >
            <div className="binderDiffControls-buttons">
                {!hasDiffChanges && <Button
                    text={t(TK.Edit_Undo)}
                    icon={<Close />}
                    onClick={() => closeDiffView(false)}
                    secondary
                />}
                {hasDiffChanges && <Button
                    text={t(TK.General_Confirm)}
                    icon={<Check />}
                    onClick={() => closeDiffView(true)}
                    CTA
                />}
            </div>
        </div>
    );
}
