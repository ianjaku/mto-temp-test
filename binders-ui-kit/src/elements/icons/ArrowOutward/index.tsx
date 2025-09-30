import * as React from "react";
import Icon from "../";

const ArrowOutward: React.FC<{ fontSize?: string }> = ({ fontSize }) =>
    <Icon name={"arrow_outward"} style={{ fontSize: fontSize ?? "20px" }} />;

export default ArrowOutward;
