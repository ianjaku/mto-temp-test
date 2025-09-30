import * as React from "react";
import Icon from "../";

export const ICON_NAME = "lock";


const style = {
    fontSize: "20px",
};


const password = (): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default password;
