import * as React from "react";
import Icon from "../";

export const ICON_NAME = "done";

const done = ({className}: {className?}): JSX.Element => (
    <Icon name={ICON_NAME} className={className}/>
);

export default done;
