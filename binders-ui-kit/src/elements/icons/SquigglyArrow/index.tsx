import * as React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Icon = require("../../../../public/icons/squiggly-arrow.svg");

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const squigglyArrow = (left) => {
    const deg = left ? 270 : 90;
    const transform = `rotate(${deg}deg)`;
    return <img className="squiggly" src={Icon} style={{ width: 18, height: 18, transform }} />;
};

export default squigglyArrow;
