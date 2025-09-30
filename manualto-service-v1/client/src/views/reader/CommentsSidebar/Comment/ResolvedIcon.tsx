import * as React from "react";
import { BasicTooltip } from "@binders/ui-kit/lib/elements/tooltip/BasicTooltip";
import { TK } from "@binders/client/lib/react/i18n/translations";
import checkCircle from "@binders/ui-kit/lib/elements/icons/CheckCircle";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ResolvedIcon.styl";

export const ResolvedIcon: React.FC = () => {
    const { t } = useTranslation();
    const [ isOpen, setIsOpen ] = React.useState(false);
    const ref: React.LegacyRef<HTMLDivElement> = useOutsideClick(() => setIsOpen(false));

    const onClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(true);
    };
    const onMouseEnter = () => setIsOpen(true);
    const onMouseLeave = () => setIsOpen(false);

    return (
        <div
            className="comment-resolved-icon"
            ref={ref}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <BasicTooltip title={t(TK.Comments_ResolvedByEditor)} isOpen={isOpen}>
                {checkCircle({
                    fontSize: "inherit",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                })}
            </BasicTooltip>
        </div>
    );
};
