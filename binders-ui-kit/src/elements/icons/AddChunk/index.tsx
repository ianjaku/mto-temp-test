import * as React from "react";
import Icon from "../";
import { isIE10Plus } from "../../../helpers/helpers";

const style = isIE10Plus() ?
    {marginLeft: "-6px"} :
    {};

export const ICON_NAME = "add";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const addChunk = (props): JSX.Element => <Icon name={ICON_NAME} style={{...style}} {...props} />;

export default addChunk;
