import * as React from "react";
import Tooltip, { TooltipPosition, hideTooltip, showTooltip } from "../tooltip/Tooltip";
import FileUpload from "../icons/FileUpload";
import MaterialIcon from "../icons";
import NoImageIcon from "../icons/NoImage";
import autobind from "class-autobind";
import classnames from "classnames";
import colors from "../../variables";
import cx from "classnames";
import { isPlaceholderVisual } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { isTouchDevice } from "@binders/client/lib/util/browsers";
import "./thumbnail.styl";

export enum ActionElementPosition {
    topLeft, bottomLeft, bottomRight,
}

export interface IActionElement {
    muiIconName: string;
    position: ActionElementPosition;
    onClick: (e) => void;
    tooltip?: string;
}

export interface IThumbnailProps {
    usePlaceholder?: boolean;
    src?: string;
    fitBehaviour?: FitBehaviour;
    bgColor?: string;
    title?: string;
    width?: number;
    selected?: boolean;
    onClick?: (e) => void;
    onDoubleClick?: () => void;
    onMouseDownCapture?: (e) => void;
    isDeletable?: boolean;
    isCloseable?: boolean;
    isSelectable?: boolean;
    onDelete?: () => void;
    onClose?: () => void;
    className?: string;
    imgClassName?: string;
    stretchImage?: boolean;
    visualIsUploading?: boolean;
    visualUploadedPercentage?: number;
    dontExceedImgDims?: boolean;
    onNewImageAdd?: () => void;
    // eslint-disable-next-line @typescript-eslint/ban-types
    outerWrapperStyle?: object;
    // eslint-disable-next-line @typescript-eslint/ban-types
    innerWrapperStyle?: object;
    // eslint-disable-next-line @typescript-eslint/ban-types
    imageStyle?: object;
    rotation?: number;
    onOrientationDetected?: (isLandscape: boolean) => void;
    actionElements?: IActionElement[];
    skipAddButton?: boolean;
    isHovered?: boolean;
    setHovered?: (hovered: boolean) => void;
    maintainsOwnHoverState?: boolean;
    centralFloatingElement?: JSX.Element;
    deleteActionIconName?: string; // MaterialUI icon names
    alwaysShowDeleteAction?: boolean; // default is `false`
}

export interface IThumbnailState {
    isLandscape: boolean;
    aspectRatio: number;
    renderWidth: number;
    tooltipText: string;
    isDevice?: boolean;
    isHovered?: boolean;
}

export enum FitBehaviour {
    FIT = 0,
    CROP = 1,
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const asHexColor = (color?: string) => {
    if (!color) {
        return "";
    }
    return color.startsWith("#") ? color : `#${color}`;
};

function classFromPosition(position: ActionElementPosition) {
    switch (position) {
        case ActionElementPosition.topLeft:
            return "thumbnail-outer-wrapper-topleft-action";
        case ActionElementPosition.bottomLeft:
            return "thumbnail-outer-wrapper-bottomleft-action";
        default:
            return "thumbnail-outer-wrapper-bottomright-action";
    }

}

class Thumbnail extends React.Component<IThumbnailProps, IThumbnailState> {

    private tooltip: Tooltip;

    public static defaultProps: Partial<IThumbnailProps> = {
        bgColor: colors.whiteColor,
    };

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.onImgLoad = this.onImgLoad.bind(this);
        autobind(this, Thumbnail.prototype);
        this.state = {
            aspectRatio: 1,
            isLandscape: true,
            renderWidth: props.width,
            tooltipText: "",
            isHovered: false,
        };
    }

    componentDidMount(): void {
        this.setState({
            isDevice: isTouchDevice(),
        })
    }

    setHovered(hovered = true): void {
        if (this.props.maintainsOwnHoverState) {
            this.setState({
                isHovered: hovered,
            });
            return;
        }
        if (this.props.setHovered) {
            this.props.setHovered(hovered);
        }
    }

    isHovered(): boolean {
        if (this.props.maintainsOwnHoverState) {
            return this.state.isHovered;
        }
        return this.props.isHovered;
    }

    handleClick(e: React.MouseEvent<HTMLElement>): void {
        this.props?.onClick?.(e);
        if (this.state.isDevice) {
            this.setHovered();
        }
    }

    onBlur(): void {
        this.setHovered(false);
    }

    public render(): JSX.Element {
        const {
            onDoubleClick,
            onMouseDownCapture,
            visualUploadedPercentage,
            usePlaceholder,
            src
        } = this.props;

        if (usePlaceholder && isPlaceholderVisual(src)) {
            return this.renderEmptyPlaceholder();
        }

        return (
            <div
                className={this.getThumbnailOuterWrapperClasses()}
                style={this.getThumbnailOuterWrapperStyle()}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
            >
                <div
                    className={this.getThumbnailWrapperClasses()}
                    style={this.getThumbnailWrapperStyle()}
                    onClick={this.handleClick}
                    onDoubleClick={onDoubleClick}
                    onMouseDownCapture={onMouseDownCapture}
                    onMouseEnter={this.buildMouseEnter()}
                    onMouseLeave={this.buildMouseLeave()}
                    onBlur={this.onBlur}
                >
                    {this.renderImage()}
                </div>
                {this.renderRemoveElement()}
                {this.renderAddElement()}
                {this.renderUploadingIcon()}
                {this.renderActionElements()}
                {this.renderProgressOverlay(visualUploadedPercentage)}
                {this.props.centralFloatingElement && (
                    <div className="thumbnail-outer-wrapper-centralFloatingElement">
                        {this.props.centralFloatingElement}
                    </div>
                )}
            </div>
        );
    }

    private renderEmptyPlaceholder(): JSX.Element {
        return (
            <div
                className={this.getThumbnailOuterWrapperClasses()}
                style={this.getThumbnailOuterWrapperStyle()}
            >
                <div className={cx("empty-placeholder")}>
                    <NoImageIcon width="40%" height="40%" opacity={0.5} />
                </div>
            </div>
        );
    }

    private renderImage() {
        const { imageStyle, src, title, rotation, stretchImage } = this.props;
        const baseStyle = stretchImage ?
            {} :
            {
                ...this.getExtraFitCropStyling(),
                ...(this.isValidImageUrl(src) ? {} : { display: "none" }),
            };
        const style: React.CSSProperties = {
            ...baseStyle,
            ...imageStyle,
            pointerEvents: "none", // prevents selecting the img element itself on mobile/tablet
        };
        if (rotation !== undefined && !isNaN(rotation)) {
            const rotate = `rotate(${rotation}deg)`;
            style.transform = style.transform ? `${style.transform} ${rotate}` : rotate;
        }
        return (
            <img
                src={src}
                title={title || src || ""}
                className={this.getImageClasses()}
                onLoad={this.onImgLoad}
                draggable={false}
                style={style}
            />
        );
    }

    private renderRemoveElement() {
        const { isCloseable, isDeletable, onDelete, onClose } = this.props;
        if (!(this.props.alwaysShowDeleteAction ?? false) && !this.isHovered()) {
            return undefined;
        }
        const onDeleteClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            onDelete();
        }

        if (isDeletable) {
            return (
                <div
                    className="thumbnail-outer-wrapper-delete-action"
                    onClick={onDeleteClick}
                    onMouseEnter={this.buildMouseEnter()}
                    onMouseLeave={this.buildMouseLeave()}
                >
                    <MaterialIcon name={this.props.deleteActionIconName ?? "delete"} />
                </div>
            );
        }
        else if (isCloseable) {
            return (
                <div
                    className="thumbnail-outer-wrapper-close-action"
                    onClick={onClose}
                    onMouseEnter={this.buildMouseEnter()}
                    onMouseLeave={this.buildMouseLeave()}
                >
                    <MaterialIcon className="material-icons" name="close" />
                </div>
            );
        }
        return undefined;
    }

    private renderAddElement() {
        const { onNewImageAdd, skipAddButton } = this.props;
        if (skipAddButton) {
            return null;
        }
        const hasNewImageAddFunction = (typeof onNewImageAdd === "function");

        return hasNewImageAddFunction && this.isHovered() && (
            <div className="thumbnail-outer-wrapper-add-action-wrapper">
                <div
                    className="thumbnail-outer-wrapper-add-action"
                    onClick={onNewImageAdd}
                    onMouseEnter={this.buildMouseEnter()}
                    onMouseLeave={this.buildMouseLeave()}
                >
                    <MaterialIcon name="add" className="material-icons" />
                </div>
            </div>
        );
    }

    private renderActionElements() {
        const { actionElements } = this.props;
        if (!(actionElements || []).length || !this.isHovered()) {
            return null;
        }
        return actionElements.map(this.renderActionElement)
    }

    private renderActionElement(actionElement: IActionElement, i: number) {
        const { muiIconName, position, onClick, tooltip } = actionElement;
        const { tooltipText } = this.state;
        return (
            <React.Fragment key={`aes-${i}`}>
                <div
                    key={`ae-${i}`}
                    className={cx(
                        "thumbnail-outer-wrapper-custom-action",
                        classFromPosition(position)
                    )}
                    onClick={onClick}
                    onMouseEnter={this.buildMouseEnter(tooltip)}
                    onMouseLeave={this.buildMouseLeave(tooltip)}
                >
                    <MaterialIcon name={muiIconName} />
                </div>
                <Tooltip key={`actionEl-${position}-tt`} ref={ref => { this.tooltip = ref; }} message={tooltipText} />
            </ React.Fragment>
        );
    }

    private renderUploadingIcon() {
        const offset = ((this.state.renderWidth || 96) / 2) - 15;
        const { visualIsUploading } = this.props;

        return visualIsUploading && (
            <span
                className="thumbnail-outer-wrapper-uploading-icon"
                style={{ left: `${offset}px`, top: `${offset}px` }}
            >
                {FileUpload({ fontSize: 30, color: colors.darkGrayColor })}
            </span>
        );
    }

    private renderProgressOverlay(width) {
        return !!width && (
            <div className="progress-overlay">
                <div className="progress-overlay-bar" style={{ width: `${width}%` }} />
            </div>
        );
    }

    private isValidImageUrl(url) {
        return !!url && url !== "//:0";
    }

    private findBehaviorClasses() {
        const { fitBehaviour, stretchImage } = this.props;
        const { isLandscape } = this.state;
        const fitBehaviourClass = this.fitBehaviourToClassname(fitBehaviour);
        const orientationClass = isLandscape ? "landscape" : "portrait";
        return stretchImage ? ["stretch-image"] : [fitBehaviourClass, orientationClass];
    }

    private getThumbnailOuterWrapperClasses() {
        const { isSelectable, selected, className } = this.props;
        const selectedClass = selected ? "is-selected" : "";
        const selectableClass = isSelectable ? "is-selectable" : "";

        return classnames(
            "thumbnail-outer-wrapper",
            selectedClass,
            selectableClass,
            { "thumbnail-outer-wrapper--hovered": this.isHovered() },
            className,
        );
    }

    private getThumbnailWrapperClasses() {
        const { fitBehaviour } = this.props;
        const { isLandscape } = this.state;
        const fitBehaviourClass = this.fitBehaviourToClassname(fitBehaviour);
        const orientationClass = isLandscape ? "landscape" : "portrait";

        return classnames(
            "thumbnail-wrapper",
            fitBehaviourClass,
            orientationClass,
        );
    }

    private getImageClasses() {
        const { imgClassName } = this.props;
        const behaviourClasses = this.findBehaviorClasses();

        return classnames(
            "thumbnail",
            ...behaviourClasses,
            imgClassName,
        );
    }

    private getWrapperStyle() {
        const { bgColor } = this.props;
        const { renderWidth } = this.state;
        const backgroundColor = bgColor === "transparent" ? "inherit" : `${asHexColor(bgColor)}`;

        return {
            backgroundColor,
            height: renderWidth,
            width: renderWidth,
        };
    }

    private getThumbnailOuterWrapperStyle() {
        const { outerWrapperStyle } = this.props;
        return {
            ...this.getWrapperStyle(),
            ...outerWrapperStyle,
        };
    }

    private getThumbnailWrapperStyle() {
        const { innerWrapperStyle } = this.props;
        return {
            ...this.getWrapperStyle(),
            ...innerWrapperStyle,
        };
    }


    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private calculateRenderWidth(imageNaturalWidth, imageNaturalHeight, aspectRatio) {
        const { width: requestedWidth, dontExceedImgDims } = this.props;
        if (!dontExceedImgDims) {
            return requestedWidth;
        }
        const widthDiff = Math.abs(Math.min(imageNaturalWidth - requestedWidth, 0));
        const heightDiff = Math.abs(Math.min(imageNaturalHeight - requestedWidth, 0));
        if (widthDiff === 0 && heightDiff === 0) {
            return requestedWidth;
        }
        return widthDiff > heightDiff ? imageNaturalHeight : imageNaturalWidth;
    }

    private buildMouseEnter(tooltip?: string) {
        return (e) => {
            this.setHovered();
            if (tooltip) {
                this.setState({
                    tooltipText: tooltip
                });
                showTooltip(e, this.tooltip, TooltipPosition.BOTTOM);
            }
        }
    }

    private buildMouseLeave(tooltip?: string) {
        return (e) => {
            this.setHovered(false);
            if (tooltip) {
                this.setState({
                    tooltipText: undefined,
                });
                hideTooltip(e, this.tooltip);
            }
        }
    }

    private onImgLoad({ target: img }) {
        const { onOrientationDetected } = this.props;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const aspectRatio = h > 0 ? w / h : 1;
        const renderWidth = this.calculateRenderWidth(w, h, aspectRatio);
        const isLandscape = !(w && h) || (w >= h);
        if (onOrientationDetected) {
            onOrientationDetected(isLandscape);
        }
        this.setState({
            aspectRatio,
            isLandscape,
            renderWidth,
        });
    }

    private getExtraFitCropStyling() {
        const { fitBehaviour } = this.props;
        const { isLandscape, renderWidth } = this.state;
        let imageWidth;
        let imageHeight;
        let extra = {};
        if (fitBehaviour === FitBehaviour.FIT) {
            if (isLandscape) {
                imageWidth = renderWidth;
                imageHeight = "auto";
            } else {
                imageWidth = "auto";
                imageHeight = renderWidth;
            }
        }
        if (fitBehaviour === FitBehaviour.CROP) {
            extra = {
                left: "50%",
                position: "absolute",
                top: "50%",
                transform: "translate(-50%, -50%)",
            };
            if (isLandscape) {
                imageWidth = "auto";
                imageHeight = renderWidth;
            } else {
                imageWidth = renderWidth;
                imageHeight = "auto";
            }
        }
        return {
            height: imageHeight,
            width: imageWidth,
            ...extra,
        };
    }

    private fitBehaviourToClassname(fitBehaviour) {
        switch (fitBehaviour) {
            case FitBehaviour.CROP:
                return "crop";
            default:
                return "fit";
        }
    }
}

export default Thumbnail;
