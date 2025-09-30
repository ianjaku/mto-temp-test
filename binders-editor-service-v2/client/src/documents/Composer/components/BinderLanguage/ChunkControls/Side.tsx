import * as React from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import TranslateChunkButton from "@binders/ui-kit/lib/elements/button/TranslateChunk";
import cx from "classnames";
import { useChunkProps } from "../../../contexts/chunkPropsContext";
import { useTranslation } from "@binders/client/lib/react/i18n";

export interface IChunkSideControlsProps {
    allowMachineTranslation?: boolean;
    currentChunkEmpty?: boolean;
    showMachineTranslation?: boolean;
    targetEmpty: boolean;
    // If the user has the translator role, then translatorLanguageCodes will be a list of languages they have permission to
    translatorLanguageCodes?: string[];
}

const ChunkSideControls: React.FC<IChunkSideControlsProps> = (props: IChunkSideControlsProps) => {
    const {
        showMachineTranslation,
        targetEmpty,
        translatorLanguageCodes,
        currentChunkEmpty,
        allowMachineTranslation
    } = props;

    const {
        isTranslating,
        onTranslate,
        isPrimary,
    } = useChunkProps();

    const nonEmptyTargetTooltipRef = React.useRef(null);
    const cantMachineTranslateTooltipRef = React.useRef(null);
    const { t }: { t: TFunction } = useTranslation();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMouseEnter = React.useCallback((e: React.MouseEvent<any>) => {
        const isTranslateMode = !!translatorLanguageCodes;
        if ((isTranslateMode && !currentChunkEmpty) || (!isTranslateMode && !targetEmpty)) {
            showTooltip(e, nonEmptyTargetTooltipRef.current, TooltipPosition.BOTTOM);
        } else if (!allowMachineTranslation && showMachineTranslation) {
            showTooltip(e, cantMachineTranslateTooltipRef.current, TooltipPosition.BOTTOM);
        }
    }, [nonEmptyTargetTooltipRef, targetEmpty, translatorLanguageCodes, currentChunkEmpty, allowMachineTranslation, showMachineTranslation]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMouseLeave = React.useCallback((e: React.MouseEvent<any>) => {
        const isTranslateMode = !!translatorLanguageCodes;
        if ((isTranslateMode && !currentChunkEmpty) || (!isTranslateMode && !targetEmpty)) {
            hideTooltip(e, nonEmptyTargetTooltipRef.current);
        } else if (!allowMachineTranslation && showMachineTranslation) {
            hideTooltip(e, cantMachineTranslateTooltipRef.current);
        }
    }, [nonEmptyTargetTooltipRef, targetEmpty, translatorLanguageCodes, currentChunkEmpty, allowMachineTranslation, showMachineTranslation]);

    const className = cx(
        "button-translate-chunk",
        {
            "button-translate-chunk--is-translating": isTranslating,
        },
    );
    const disableTranslateChunkButton = !allowMachineTranslation || (translatorLanguageCodes ? !currentChunkEmpty : !targetEmpty)
    return (
        <div
            className={cx("chunk-side-button-area", { "chunk-side-button-area--secondary": !isPrimary })}
            tabIndex={-1}
        >
            {showMachineTranslation && (
                <>
                    <TranslateChunkButton
                        onClick={onTranslate}
                        isPositionLeft={translatorLanguageCodes ? isPrimary : !isPrimary}
                        className={className}
                        disabled={disableTranslateChunkButton}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                    />
                    <Tooltip key="target-non-empty-tt" ref={nonEmptyTargetTooltipRef} message={t(TK.Edit_TranslateFailNonEmpty)} />
                    <Tooltip key="cant-machine-translate" ref={cantMachineTranslateTooltipRef} message={t(TK.Edit_TranslateNotSupported)} />
                </>
            )}
        </div>
    );
}

export default ChunkSideControls;
