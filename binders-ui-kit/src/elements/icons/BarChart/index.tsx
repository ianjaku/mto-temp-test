import * as React from "react";
import Icon from "../";

export const ICON_NAME = "bar_chart";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const barChart = (color): JSX.Element => <Icon name={ICON_NAME} color={color} />;

export default barChart;
