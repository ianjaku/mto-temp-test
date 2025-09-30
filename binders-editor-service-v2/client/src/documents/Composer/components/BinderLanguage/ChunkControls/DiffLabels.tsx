import * as React from "react";
import {
    useBinderLanguageComputedProps,
    useBinderLanguageProps,
} from "../../../contexts/binderLanguagePropsContext";
import { FC } from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useBinderDiff } from "../../../../../content/BinderDiffProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./DiffLabels.styl"

export const ChunkDiffViewLabels: FC<{ chunkIndex: number }> = ({ chunkIndex }) => {
    const { isPrimary } = useBinderLanguageProps();
    const { langIdx } = useBinderLanguageComputedProps();
    const { binderDiffStateMap } = useBinderDiff();
    const { t } = useTranslation();
    const chunkDiffState = binderDiffStateMap[langIdx]?.[chunkIndex] ?? "Diff";

    let className = "";
    let labelTitle = "";
    switch (chunkDiffState) {
        case "NoDiff_Changed":
            className = "diff-label__accent__solid";
            labelTitle = t(TK.Edit_AiOptimizeChunkLabelOptimised);
            break;
        case "NoDiff_Original":
            className = "diff-label__normal__solid";
            labelTitle = t(TK.Edit_AiOptimizeChunkLabelOriginal);
            break;
        case "Diff":
            className = isPrimary ? "diff-label__normal" : "diff-label__accent";
            labelTitle = isPrimary ?
                t(TK.Edit_AiOptimizeChunkLabelOriginal) :
                t(TK.Edit_AiOptimizeChunkLabelOptimised);
            break;
    }

    return (
        <div className="chunk-controls-diff-labels">
            <div className={cx(
                "chunk-controls-diff-label",
                "diff-label",
                className,
            )}>{labelTitle}</div>
        </div>
    )
}
