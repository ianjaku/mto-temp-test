import * as React from "react";
import { FaIcon, FaIconProps } from "@binders/client/lib/react/icons/font-awesome";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import Icon from "@binders/ui-kit/lib/elements/icons";
import cx from "classnames";
import "./CircleButton.styl";

export type CircleButtonProps = Partial<{
    id?: string;
    value: string;
    text: string;
    subText: string;
    faIcon: FaIconProps["name"];
    materialIcon: string;
    isSelected: boolean;
    isLoading: boolean;
    className: string;
    onMouseOver: () => void;
    onMouseLeave: () => void;
    onSelect: (...values: string[]) => void;
    style?: React.CSSProperties;
}>

export const CircleButton: React.FC<CircleButtonProps> = (
    { id, value, text, subText, isSelected, onSelect, faIcon, materialIcon, isLoading, className, onMouseOver, onMouseLeave, style }
) => {
    const renderFaIcon = () => {
        if (!faIcon) return null;
        return <FaIcon name={faIcon} className="circlebutton-inner" />;
    };

    const renderMaterialIcon = () => {
        if (!materialIcon) return null;
        return (
            <Icon name={materialIcon} className="circlebutton-inner" />
        )
    }

    const renderText = () => {
        if (text === "nl" && subText === "GH") {
            return (
                <div className="circlebutton-inner-wrapper">
                    <label className={cx("circlebutton-inner", "circlebutton-inner--text", "circlebutton-inner-mainValueSmall")}>
                        GENTS
                    </label>
                </div>
            )
        }
        return (
            <div className="circlebutton-inner-wrapper">
                <label className={cx("circlebutton-inner", { "circlebutton-inner-mainvalue": !!subText })}>
                    {text}
                </label>
                {
                    subText && (
                        <label className={cx("circlebutton-inner", "circlebutton-inner--text", "circlebutton-inner-subvalue")}>
                            {subText}
                        </label>
                    )
                }
            </div>
        );
    };

    const renderInnerHtml = () => {
        if (isLoading) return CircularProgress();
        if (faIcon) return renderFaIcon();
        if (materialIcon) return renderMaterialIcon();
        return renderText();
    };

    const onClick = (e: React.MouseEvent) => {
        onSelect(...((value !== undefined) ? [ value ] : []));
        e.stopPropagation();
    };
    return (
        <div
            className={cx("circlebutton", { "circlebutton--isSelected": isSelected }, { "circlebutton--loading": isLoading }, className)}
            onClick={onClick}
            onMouseOver={onMouseOver}
            onMouseLeave={onMouseLeave}
            id={id}
            style={style}
        >
            {renderInnerHtml()}
        </div>
    );
};