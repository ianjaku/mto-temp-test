import * as React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Icon = require("../../../../public/icons/qr-code.svg");

class QRCodeIcon extends React.Component {
    public render(): JSX.Element {
        return <img src={Icon} />;
    }
}

export default QRCodeIcon;
