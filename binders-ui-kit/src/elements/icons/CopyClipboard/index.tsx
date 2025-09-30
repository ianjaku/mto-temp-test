import * as React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Icon = require("../../../../public/icons/copy-to-clipboard.svg");

class ClipboardIcon extends React.Component<{
    testId?: string
}> {
    public render(): JSX.Element {
        return <img src={Icon} data-testid={this.props.testId} />;
    }
}

export default ClipboardIcon;
