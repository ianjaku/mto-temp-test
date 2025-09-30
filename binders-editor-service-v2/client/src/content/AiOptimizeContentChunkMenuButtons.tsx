import * as React from "react";
import { ChunkLoadingState, useChunkState } from "../documents/Composer/contexts/chunkStateContext";
import {
    captureEventApplyAiFormattingContextMenuClicked,
    computeEventBinderDiffProps,
} from "./events";
import { useChunkAiOptimization, useEventBinderContextProps } from "./hooks";
import { AiFormatIcon } from "@binders/ui-kit/lib/elements/icons/AiFormat";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { FC } from "react";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UndoIcon from "@binders/ui-kit/lib/elements/icons/Undo";
import { useBinderUpdate } from "./BinderUpdateProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const AiOptimizeContentChunkMenuButtons: FC<{
    binderObj: BinderClass;
    chunkIdx: number;
    langIdx: number;
    toggleMenu: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ binderObj, chunkIdx, langIdx, toggleMenu }) => {
    const { t } = useTranslation();
    const { chunkState } = useChunkState(chunkIdx);
    const { updateBinder } = useBinderUpdate();
    const { apply: modifyChunk, undo: undoChunk } = useChunkAiOptimization(
        binderObj,
        langIdx,
        updateBinder,
    );
    const eventBinderContextProps = useEventBinderContextProps({ binder: binderObj, langIdx });

    return (
        <>
            <MenuItem
                key="aiFormatting"
                disabled={chunkState.loadingState === ChunkLoadingState.Loading}
                onClick={() => {
                    modifyChunk(chunkIdx);
                    toggleMenu(false);
                    captureEventApplyAiFormattingContextMenuClicked({
                        ...eventBinderContextProps,
                        ...computeEventBinderDiffProps(binderObj, null, { langIdx, chunkIdx }),
                        chunkIdx,
                    });
                }}
                title={t(TK.Edit_AiOptimizeChunk)}
                icon={<AiFormatIcon />}
            />
            {chunkState.hasAiFormattingState ?
                <MenuItem
                    key="aiFormattingUndo"
                    onClick={() => { undoChunk(chunkIdx); toggleMenu(false); }}
                    title={t(TK.Edit_AiOptimizeChunkUndo)}
                    icon={<UndoIcon />}
                /> :
                null}
        </>
    )
}
