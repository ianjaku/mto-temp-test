import * as React from "react";
import { FC } from "react";
import { PersonIcon } from "@binders/ui-kit/lib/elements/icons/Person/Person";
import "./Avatar.styl";

const AVATAR_COLORS = [
    "#FAC242",
    "#EB5757",
    "#F2994A",
    "#219653",
    "#27AE60",
    "#2F80ED",
    "#2D9CDB",
    "#9B51E0",
    "#BB6BD9"
]

const pickColor = (displayName: string): string => {
    let totalCharCode = 0;
    for (let i = 0; i < displayName.length; i++) {
        totalCharCode += displayName.charCodeAt(i);
    }
    const colorIndex = totalCharCode % AVATAR_COLORS.length;
    return AVATAR_COLORS[colorIndex];
}

export const Avatar: FC<{ displayName: string; size?: string }> = (props) => {
    const color = React.useMemo(() => pickColor(props.displayName), [props.displayName]);
    
    return (
        <div className="avatar" style={{
            backgroundColor: color,
            width: props.size,
            height: props.size
        }}>
            <PersonIcon />
        </div>
    )
}