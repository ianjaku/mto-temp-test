import * as React from "react";
import { TextAlignProperty } from "csstype";
import classNames from "classnames";

export const enum FloaterAppearance {
    default,
    narrow,
    unrestrictedWidth,
}

export interface IFloaterProps {
    arrowLeft?: number;
    arrowPosition?: string;
    className?: string;
    collapsed: boolean;
    onBlur?: () => void;
    onFocus?: (e?) => void;
    left: number | string;
    top: number | string;
    appearance?: FloaterAppearance;
    widthOverride?: string | number;
}

interface IFloaterStyle {
    top: number | string;
    left: number | string;
    width: string;
    textAlign: TextAlignProperty;
}

// eslint-disable-next-line @typescript-eslint/ban-types
class Floater extends React.Component<IFloaterProps, {}> {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.makeFloaterStyle = this.makeFloaterStyle.bind(this);
    }

    makeFloaterStyle(top: number | string, left: number | string): IFloaterStyle {
        const { appearance, widthOverride } = this.props;
        if (appearance === FloaterAppearance.unrestrictedWidth) {
            return {
                width: "auto",
                textAlign: "left",
                top,
                left,
            };
        }
        if (appearance === FloaterAppearance.narrow) {
            return {
                width: `${widthOverride || "170px"}`,
                textAlign: "center",
                top,
                left,
            };
        }
        return {
            width: `${widthOverride || "480px"}`,
            textAlign: "justify",
            top,
            left,
        };
    }

    public render(): JSX.Element {
        const { arrowLeft, arrowPosition, children, className, collapsed, left, top, onBlur, onFocus } = this.props;
        return (
            <div
                className={classNames("rte-button-bar", className, { collapsed })}
                style={this.makeFloaterStyle(top, left)}
                onBlur={onBlur}
                onFocus={onFocus}
            >
                {children}
                <div
                    className={`rte-toolbar-arrow arrow-${arrowPosition}`}
                    style={{ left: arrowLeft }}
                />
            </div>
        );
    }
}


export default Floater;
