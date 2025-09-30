/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as React from "react";
import FloatingMenu from "../../floatingmenu";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

export interface Props {
    arrowLeft: number;
    arrowPosition: string;
    left: string | number;
    top: string | number;
    onClick: () => void;
}

const ClearFormattingMenu: React.FC<Props> = ({
    left,
    top,
    arrowLeft,
    arrowPosition,
    onClick,
}) => {
    const { t } = useTranslation();
    return (
        <FloatingMenu
            left={left}
            top={top}
            arrowLeft={arrowLeft}
            arrowPosition={arrowPosition}
            items={[
                {
                    text: t(TK.Edit_ClearFormatting),
                    onClick,
                }
            ]}
            name="clear-formatting"
        />
    )

}

export default ClearFormattingMenu;
