import * as React from "react";
import * as ReactDOM from "react-dom";
import { createPortal } from "react-dom";
import cx from "classnames";
import "./tooltip.styl";

export interface ITooltipProps {
    message: string;
    fadeIn?: number;
    fadeOnTimeout?: boolean;
    arrowOnBottom?: boolean;
    respectLineBreaks?: boolean;
}

export interface ITooltipState {
    top: string;
    left: string;
    show: boolean;
}

export class Tooltip extends React.Component<ITooltipProps, ITooltipState> {

    public static defaultProps = {
        fadeIn: 2000,
        fadeOnTimeout: true,
    };

    private timeoutId: ReturnType<typeof setTimeout>;
    private component: React.ReactInstance;
    private mounted: boolean;

    constructor(props: ITooltipProps) {
        super(props);

        this.showTooltipAt = this.showTooltipAt.bind(this);
        this.hideTooltip = this.hideTooltip.bind(this);

        this.state = {
            left: "0px",
            show: false,
            top: "0px",
        };
    }
    public componentDidMount(): void {
        this.mounted = true;
    }
    public componentWillUnmount(): void {
        this.mounted = false;
    }
    public componentDidUpdate(_prevProps: ITooltipProps, prevState: ITooltipState): void {
        const { fadeOnTimeout } = this.props;
        if (fadeOnTimeout && !prevState.show && this.state.show) {
            this.timeoutId = setTimeout(this.hideTooltip, this.props.fadeIn);
        }
    }

    public getWidth(): number {
        const node = ReactDOM.findDOMNode(this.component) as HTMLElement;
        return node.getBoundingClientRect().width;
    }

    private setStateIfMounted(stateUpdate: Partial<ITooltipState>): void {
        if (this.mounted) {
            this.setState(stateUpdate as ITooltipState);
        }
    }

    public showTooltipAt(top: string, left: string): void {
        const show = !this.state.show;
        clearTimeout(this.timeoutId);
        this.setStateIfMounted({ top, left, show });
    }

    public hideTooltip(): void {
        clearTimeout(this.timeoutId);
        this.setStateIfMounted({ show: false });
    }

    public render(): JSX.Element {
        const { message } = this.props;
        const { top, left, show } = this.state;
        const visibility = show ? "visible" : "hidden";

        return createPortal(
            <div
                ref={ref => { this.component = ref; }}
                className={cx("tooltip", { "tooltip--respectLineBreaks": this.props.respectLineBreaks })}
                style={{ top, left, visibility }}
            >
                {this.props.arrowOnBottom && (
                    <div className="tooltip-arrowOnBottom" />
                )}
                <span>{message}</span>
            </div>
            , document.body);
    }
}

export enum TooltipPosition {
    TOP,
    LEFT,
    RIGHT,
    BOTTOM,
}

export function showTooltip(
    e: React.MouseEvent<HTMLElement>,
    tooltip: Tooltip,
    position = TooltipPosition.BOTTOM,
    nudgePosition: { top?: number, left?: number } = { top: 0, left: 0 },
): void {
    const caller = e.target as HTMLElement;
    const viewportOffset = caller.getBoundingClientRect();
    showTooltipForBoundingClientRect(viewportOffset, tooltip, position, nudgePosition);
}

export function showTooltipForBoundingClientRect(
    rect: DOMRect,
    tooltip: Tooltip,
    position = TooltipPosition.BOTTOM,
    nudgePosition: { top?: number, left?: number } = { top: 0, left: 0 },
): void {
    const { top: calculatedTop, left: calculatedLeft } = calculateTooltipCoordinates(tooltip, rect, position);
    const top = calculatedTop + (nudgePosition.top ?? 0);
    const left = calculatedLeft + (nudgePosition.left ?? 0);
    if (tooltip && (top > 0 || left > 0)) {
        tooltip.showTooltipAt(`${top}px`, `${left}px`);
    }
}

export function hideTooltip(_e: React.MouseEvent<HTMLElement>, tooltip: Tooltip): void {
    if (tooltip) {
        tooltip.hideTooltip();
    }
}

function calculateTooltipCoordinates(tooltip: Tooltip, rect: DOMRect, position: TooltipPosition, it = 0): { top: number; left: number; } {
    if (it > 1 || !tooltip) {
        return { top: 0, left: 0 };
    }

    const { innerWidth, innerHeight } = window;
    const { top, left, height, width } = rect;
    const tooltipWidth = tooltip.getWidth();

    switch (position) {
        case TooltipPosition.TOP:
            return top - height > 0 ?
                { top: top - height - 10, left } :
                calculateTooltipCoordinates(tooltip, rect, TooltipPosition.BOTTOM, it + 1);
        case TooltipPosition.LEFT:
            return left - tooltipWidth > 0 ?
                { top, left: left - tooltipWidth } :
                calculateTooltipCoordinates(tooltip, rect, TooltipPosition.RIGHT, it + 1);
        case TooltipPosition.RIGHT:
            return left + width < innerWidth ?
                { top, left: left + width } :
                calculateTooltipCoordinates(tooltip, rect, TooltipPosition.LEFT, it + 1);
        default:
            return top + height < innerHeight ?
                { top: top + height, left } :
                calculateTooltipCoordinates(tooltip, rect, TooltipPosition.TOP, it + 1);
    }
}

export default Tooltip;
