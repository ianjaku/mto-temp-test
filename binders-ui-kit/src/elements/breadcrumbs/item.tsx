import * as React from "react";
import Tooltip, { TooltipPosition, hideTooltip, showTooltip } from "../tooltip/Tooltip";
import { Link } from "react-router-dom";
import cx from "classnames";

export interface IBreadcrumbProps {
    name: string;
    link?: string;
    isLast: boolean;
    isReadonly?: boolean;
    onClick?: (object) => void;
    maxWidth?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itemContextMenu?: ((data) => React.ReactElement<any>) | JSX.Element;
    hasItemContextMenu?: boolean;
    isStrikeThrough?: boolean;
    tooltip?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class BreadcrumbItem extends React.Component<IBreadcrumbProps, any> {


    private bcTooltip;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.onClick = this.onClick.bind(this);
    }

    private handleMouseEnter(e: React.MouseEvent<HTMLElement>) {
        const { tooltip } = this.props;
        if (tooltip) {
            showTooltip(e, this.bcTooltip, TooltipPosition.BOTTOM);
        }
    }

    private handleMouseLeave(e: React.MouseEvent<HTMLElement>) {
        const { tooltip } = this.props;
        if (tooltip) {
            hideTooltip(e, this.bcTooltip);
        }
    }

    public render(): JSX.Element {
        const { name, link, isLast, isReadonly, isStrikeThrough, tooltip,
            itemContextMenu, maxWidth, hasItemContextMenu } = this.props;
        if (name?.startsWith("AV300-") || !link) {
            return (
                <span className="breadcrumbs-item">{name}</span> // temp, for debugging purpose
            );
        }
        const item = (isLast && hasItemContextMenu) ?
            (
                <span
                    className="breadcrumbs-item breadcrumbs-item--last"
                    style={maxWidth ? { maxWidth: `${maxWidth}px` } : {}}
                    onMouseEnter={this.handleMouseEnter.bind(this)}
                    onMouseLeave={this.handleMouseLeave.bind(this)}
                >
                    <span
                        className="breadcrumbs-item--active"
                    >
                        <span>{name}</span>
                    </span>
                    {itemContextMenu}
                </span>
            ) :
            (
                <span
                    onMouseEnter={this.handleMouseEnter.bind(this)}
                    onMouseLeave={this.handleMouseLeave.bind(this)}
                >
                    <Link
                        className={cx(
                            "breadcrumbs-item",
                            { "breadcrumbs-item--readonly": isReadonly },
                            { "breadcrumbs-item--strikeThrough": isStrikeThrough },
                            { "breadcrumbs-item--active": isLast },
                        )}
                        to={link}
                        style={maxWidth ? { maxWidth: `${maxWidth}px` } : {}}
                        tabIndex={-1}
                    >
                        {name}
                    </Link>
                </span>
            );
        return (
            <>
                {item}
                {tooltip && <Tooltip ref={ref => { this.bcTooltip = ref; }} message={tooltip} />}
            </>
        );
    }

    private onClick = e => {
        if (this.props.onClick) {
            const { name, link } = this.props;
            e.preventDefault();
            this.props.onClick({ name, link });
        }
    }
}

export default BreadcrumbItem;
