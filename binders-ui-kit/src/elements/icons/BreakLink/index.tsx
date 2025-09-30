import * as React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Icon = require("../../../../public/icons/break-link.svg");

class BreakLinkIcon extends React.Component {
    public render(): JSX.Element {
        return <img src={Icon} />;
    }
}

export default BreakLinkIcon;
