import * as React from "react";
import { RwdRecord, selectInRwdRecord } from "../../helpers/rwd";
import CloseIcon from "../icons/Close";
import { Markdown } from "../Markdown";
import cx from "classnames";

export interface IModalHeaderProps {
    title: string;
    titleHtml: RwdRecord;
    noCloseIcon?: boolean;
    onClose: (e) => void;
    closeIcon?: React.ReactElement;
    additionalHeaderChildren?: Array<{ element: React.ReactElement, additionalClassName?: string }>;
    color?: string;
    uncloseable?: boolean;
    withoutPadding?: boolean;
}

class ModalHeader extends React.Component<IModalHeaderProps, unknown> {
    public static defaultProps: Partial<IModalHeaderProps> = {
        additionalHeaderChildren: [],
    };
    public render(): JSX.Element {
        const {
            additionalHeaderChildren,
            closeIcon,
            color,
            noCloseIcon,
            onClose,
            title,
            titleHtml,
            uncloseable,
        } = this.props;

        return (
            <header
                className={cx(
                    "modal-header",
                    { "modal-header--no-padding": this.props.withoutPadding },
                )}
                style={{ ...(color ? { background: color } : {}) }}>
                {!title && !titleHtml ? <span></span> : <></>}
                {title && <h3 className="modal-header-title">{title}</h3>}
                {!title && titleHtml && <Markdown element="h3" className="modal-header-title">{selectInRwdRecord(titleHtml)}</Markdown>}
                {additionalHeaderChildren.map(({ element }, key) => <div key={`modalHeader-child-${key}`} className={"additional-children"}>{element}</div>)}
                {!uncloseable && !noCloseIcon && (
                    <button onClick={onClose} className="modal-closeBtn">
                        {closeIcon ? closeIcon : CloseIcon({ "color": "inherit" })}
                    </button>
                )}
                {this.props.children}
            </header>
        );
    }
}

export default ModalHeader;
