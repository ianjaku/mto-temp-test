import * as React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Icon = require("../../../../public/icons/unknown.svg");

const UnknownIcon = (): JSX.Element => {
    const onDragStart = React.useCallback((e) => e.preventDefault(), []);
    return (
        <img src={Icon} onDragStart={onDragStart} />
    );
}

export default UnknownIcon;
