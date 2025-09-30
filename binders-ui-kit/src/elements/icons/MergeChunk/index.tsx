import * as React from "react";
import Icon from "../";
import { isIE10Plus } from "../../../helpers/helpers";

const style = isIE10Plus() ?
    {marginLeft: "-6px"} :
    {};

export const ICON_NAME = "vertical_align_center";

const mergeChunk = (): JSX.Element => (
    <Icon
        name={ICON_NAME}
        style={style}
    />
);

export default mergeChunk;
