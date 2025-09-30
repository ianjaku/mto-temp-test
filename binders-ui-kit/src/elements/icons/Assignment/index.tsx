import * as React from "react";
import Icon from "../";

const Assignment: React.FC<{ fontSize?: string }> = ({ fontSize }) =>
    <Icon name={"assignment"} style={{ fontSize: fontSize ?? "20px" }} />;

export default Assignment;
