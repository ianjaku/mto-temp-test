import * as React from "react";
import { ModalBodyPadding } from ".";
import cx from "classnames";

export interface IModalBodyProps {
    bodyPadding: ModalBodyPadding;
    withBodyEl?: (bodyEl: HTMLDivElement) => React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ModalBody extends React.Component<IModalBodyProps, any> {

    private bodyEl: HTMLDivElement;

    public render(): JSX.Element {
        const classes = cx(
            "modal-body",
            { "modal-body--withoutPadding": this.props.bodyPadding === ModalBodyPadding.None },
            { "modal-body--mediumPadding": this.props.bodyPadding === ModalBodyPadding.Medium },
        );
        return (
            <div
                className={classes}
                ref={el => this.bodyEl = el}
            >
                {this.props.children && this.props.children}
                {this.props.withBodyEl && this.props.withBodyEl(this.bodyEl)}
            </div>
        );
    }
}

export default ModalBody;
