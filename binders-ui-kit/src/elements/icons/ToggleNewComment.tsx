import * as React from "react";
import Icon from "./index";
import { isIE10Plus } from "../../helpers/helpers";

const style = isIE10Plus() ?
    {marginLeft: "-4px"} :
    {};

export const ICON_NAME = "comment";

const comment: React.FC = () => <Icon name={ICON_NAME} style={style} />;

export default comment;
