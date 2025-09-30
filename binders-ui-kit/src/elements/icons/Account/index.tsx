import * as React from "react";
import Icon from "../";

export const ICON_NAME = "person";

const style = {
    fontSize: "20px",
};

const account = (): JSX.Element => <Icon name={ICON_NAME} style={style} />;

export default account;
