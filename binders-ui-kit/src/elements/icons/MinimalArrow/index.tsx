import * as React from "react";
import ArrowForwardIosIcon from "@material-ui/icons/ArrowForwardIos";

interface Props {
    direction?: "left" | "right";
}

const MinimalArrow: React.FC<Props> = ({ direction }) => {
    return (
        <span
            className="minimal-arrow"
        >
            <ArrowForwardIosIcon
                style={{
                    ...(direction === "left" ? { transform: "rotate(180deg)" } : {}),
                }}
            />
        </span>
    )
}

export default MinimalArrow