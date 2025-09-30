import * as React from "react";

export interface IModalFooterProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buttons: any[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ModalFooter extends React.Component<IModalFooterProps, any> {

    public static defaultProps: Partial<IModalFooterProps> = {
        buttons: [],
    };

    public render(): JSX.Element {
        const { buttons } = this.props;

        const buttonComponents = buttons.map((button, key) => <li key={key}>{button}</li>);

        return (
            <div className="modal-footer">
                <ul>{buttonComponents}</ul>
            </div>
        );
    }
}

export default ModalFooter;
