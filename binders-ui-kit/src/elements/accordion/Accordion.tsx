import * as React from "react";
import Icon from "../icons";
import autobind from "class-autobind";
import classnames from "classnames";
import "./accordion.styl";

export interface IAccordionProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    header: React.ReactElement<any> | string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children?: React.ReactElement<any> | Array<React.ReactElement<any>>;
    onToggle?: () => void;
    onOpen?: () => void;
    isOpened?: boolean;
    className?: string;
    noGaps?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Accordion extends React.Component<IAccordionProps, any> {

    private static defaultProps = {
        isOpened: false,
    };

    constructor(props: IAccordionProps) {
        super(props);
        autobind(this, Accordion.prototype);
    }

    public renderHeader(): JSX.Element {
        const { header, isOpened } = this.props;
        const openedClass = { "is-opened": isOpened };
        const arrowClasses = classnames("accordion-arrow", openedClass);
        const headerClasses = classnames("accordion-header", openedClass);

        return (
            <div className={headerClasses} onClick={this.onToggle}>
                <Icon name="arrow_drop_down" className={arrowClasses} />
                {header}
            </div>
        );
    }

    public renderChildren(): JSX.Element {
        const { children, isOpened } = this.props;

        return isOpened && (
            <div className="accordion-body">
                {children}
            </div>
        );
    }

    public render(): JSX.Element {
        const { isOpened, noGaps } = this.props;
        return (
            <div className={classnames("accordion", this.props.className, { "is-opened": isOpened }, { "accordion--noGaps": noGaps })}>
                {this.renderHeader()}
                {this.renderChildren()}
            </div>
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onToggle(e) {
        const { isOpened, onOpen, onToggle } = this.props;
        if (onToggle) {
            onToggle();
        }
        if (onOpen && !isOpened) {
            onOpen();
        }
    }
}

export default Accordion;
