import React, { MouseEvent, useRef } from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { useTranslation } from "@binders/client/lib/react/i18n";
import vars from "@binders/ui-kit/lib/variables";

interface Props {
    onClickMachineTranslation: () => void;
    isTranslating?: boolean;
}

export const ToolbarLanguageMachineTranslateButton: React.FC<Props> = (props) => {
    const tooltipMTRef = useRef(null);
    const { t } = useTranslation();
    return (
        <>
            <Tooltip ref={tooltipMTRef} message={t(TK.Reader_MachineTranslation_Tooltip)} />
            <div
                className="toolbarLanguage-button"
                onClick={props.onClickMachineTranslation}
                onMouseEnter={(e: MouseEvent<HTMLElement>) => {
                    showTooltip(e, tooltipMTRef.current, TooltipPosition.BOTTOM, { top: 7, left: 0 });
                }}
                onMouseLeave={(e: MouseEvent<HTMLElement>) => hideTooltip(e, tooltipMTRef.current)}
            >
                {props.isTranslating ?
                    circularProgress(undefined, undefined, undefined, vars.baseColor) :
                    (
                        <Icon
                            name="translate"
                            className="relative left-[2px] top-[3px]"
                        />
                    )
                }
            </div>
        </>
    )
}
