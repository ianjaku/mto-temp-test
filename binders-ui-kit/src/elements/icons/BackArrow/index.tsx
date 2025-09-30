import * as React from "react";
import Icon from "../";

export const ICON_NAME = "arrow_back";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const leftArrow = (props): JSX.Element => <Icon {...props} name={ICON_NAME} />;

export default leftArrow;
