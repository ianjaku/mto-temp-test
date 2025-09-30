/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as React from "react";
import Floater, { FloaterAppearance } from "../floater/Floater";
import ToolbarButton from "../text-editor/components/ToolbarButton";

export interface FloatingMenuItem {
    text: string;
    onClick?: () => void;
    disabled?: boolean;
}

export interface Props {
    arrowLeft: number;
    arrowPosition: string;
    left: string | number;
    top: string | number;
    items: FloatingMenuItem[];
    name: string; // to be used in the keys of the items
    unrestrictedWidth?: boolean;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const FloatingMenu: React.FC<Props> = ({
    arrowLeft, arrowPosition, left, top, items, name, unrestrictedWidth,
}) => {

    return (
        <Floater
            collapsed={false}
            left={left}
            top={top}
            arrowLeft={arrowLeft}
            arrowPosition={arrowPosition}
            appearance={unrestrictedWidth ? FloaterAppearance.unrestrictedWidth : FloaterAppearance.narrow}
        >
            <div className="rte-button-group">
                {items.map((item, i) => {
                    return (
                        <ToolbarButton
                            key={`floatingmenubtn-${name}${i}`}
                            text={item.text}
                            onClick={item.onClick}
                            title={item.text}
                            extraClassName="rte-button--textButton"
                            disabled={item.disabled}
                        />)
                })}
            </div>
        </Floater>
    );

}

export default FloatingMenu;
