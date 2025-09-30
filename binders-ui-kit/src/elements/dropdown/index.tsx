import * as React from "react";
import * as ReactDOM from "react-dom";
import { CSSProperties } from "@material-ui/core/styles/withStyles";
import DropDownElement from "./DropdownElement";
import DropdownArrow from "../icons/DropdownArrow";
import DropupArrow from "../icons/DropupArrow";
import { NavbarMenuItemType } from "../navbar";
import classnames from "classnames";
import debounce from "lodash.debounce";
import "./dropdown.styl";

export interface IDropdownProps {
    id?: string;
    type: string;
    elements: IDropdownElement[];
    onClick?: () => void;
    open?: boolean;
    selectedElementId?: string | number;
    dropUp?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelectElement?: (id) => any;
    maxRows?: number;
    width?: number;
    showBorders?: boolean;
    horizontalRulePositions?: number[];
    floatingElements?: boolean;
    arrowColor?: string;
    className?: string;
    elementsClassName?: string;
    isDisabled?: boolean;
    selectedLabelPrefix?: string;
    hideSelectedElementInList?: boolean;
    labelLess?: boolean;
    // eslint-disable-next-line @typescript-eslint/ban-types
    style?: object;
    unselectableElements?: boolean;
    limitMenuWidth?: boolean;
    keepOpen?: boolean;
    maxHeight?: number;
    unselectable?: boolean;
    noMargin?: boolean;
    dropdownElementsPortalTarget?: HTMLElement;
    dropdownRef?: HTMLElement;
    variant?: "outlined";
    maxWidthLabel?: number;
    "data-testid"?: string;
}

export interface IDropdownState {
    selectedElementId?: string | number;
    open?: boolean;
    elements: IDropdownElement[];
}

export interface IDropdownElement {
    id: string | number;
    label: string;
    avatar?: string;
    disabled?: boolean;
    isGrayedOut?: boolean;
    bgColor?: string;
    rotation?: number | string;
    icon?: string;
    iconEl?: () => JSX.Element;
    url?: string;
    type?: NavbarMenuItemType;
    fitBehaviour?: string;
}

class Dropdown extends React.Component<IDropdownProps, IDropdownState> {

    static defaultProps = {
        open: false,
        selectedLabelPrefix: "",
    };

    private dropdown: HTMLDivElement;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props: IDropdownProps) {
        super(props);
        this.onSelectElement = this.onSelectElement.bind(this);
        this.onClick = debounce(this.onClick.bind(this), 100);
        this.close = this.close.bind(this);
        this.renderArrow = this.renderArrow.bind(this);
        this.getMaxHeight = this.getMaxHeight.bind(this);
        this.renderList = this.renderList.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.state = {
            open: props.open,
            selectedElementId: props.selectedElementId,
            elements: props.elements || [],
        };
    }

    public componentDidUpdate(prevProps: IDropdownProps): void {
        if (!this.props.keepOpen && prevProps.open !== this.props.open) {
            this.setState({
                open: this.props.open,
            });
        }
        if (this.props.selectedElementId !== prevProps.selectedElementId) {
            this.setState({
                selectedElementId: this.props.selectedElementId
            });
        }
        if (this.props.elements !== prevProps.elements) {
            this.setState({
                elements: this.props.elements
            });
        }
    }

    handleClickOutside(event: Event): void {
        if (
            !this.props.keepOpen &&
            this.dropdown &&
            !this.dropdown.contains(event.target as Node) &&
            (this.props.dropdownRef && !this.props.dropdownRef.contains(event.target as Node))
        ) {
            this.close();
        }
    }

    componentDidMount(): void {
        document.addEventListener("click", this.handleClickOutside, true);
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.handleClickOutside, true);
    }

    public render(): JSX.Element {
        const { className, showBorders, width, labelLess, style } = this.props;
        const { open } = this.state;
        return (
            <div
                id={this.props.id}
                className={classnames(
                    "dropdown",
                    { "dropdown--borders": showBorders !== false },
                    className,
                    { "dropdown--is-open": open },
                    { "dropdown--outlined": this.props.variant === "outlined" },
                )}
                style={{ width: `${width}px` || "auto", ...style }}
                ref={ref => { this.dropdown = ref; }}
                {...this.props["data-testid"] ? { "data-testid": this.props["data-testid"] } : {}}
            >
                {!labelLess && this.renderLabel()}
                {this.renderList()}
            </div>
        );
    }

    public renderArrow(): JSX.Element {
        const { arrowColor, dropUp, isDisabled } = this.props;
        return (
            <div className="dropdown-arrow-icon" style={{ visibility: isDisabled ? "hidden" : "visible", display: "flex", alignItems: "center" }} >
                {dropUp ?
                    <DropupArrow color={arrowColor} /> :
                    <DropdownArrow color={arrowColor} />
                }
            </div>
        )
    }

    private renderLabel() {
        const { isDisabled, type, selectedLabelPrefix } = this.props;
        const { selectedElementId, elements } = this.state;
        const selectedElement = elements.find(e => e.id == selectedElementId); // double equals is intentional, selectedElementId can be string/number

        const defaultSelection = { id: -1, label: type };
        return (
            <ul
                tabIndex={0}
                className={classnames("dropdown-field", { ["is-disabled"]: isDisabled })}
                onBlur={this.close}
            >
                <DropDownElement
                    element={selectedElement || defaultSelection}
                    prefix={selectedLabelPrefix}
                    onElementClick={this.onClick}
                    maxWidthLabel={this.props.maxWidthLabel}
                    usage="label"
                >
                    {this.renderArrow()}
                </DropDownElement>
            </ul>
        );
    }

    private renderList() {
        const {
            labelLess,
            isDisabled,
            floatingElements,
            dropUp,
            maxRows,
            limitMenuWidth,
            dropdownElementsPortalTarget,
            elementsClassName,
        } = this.props;
        const { open } = this.state;

        if (!open || isDisabled) {
            return null;
        }

        const isDropUp = { "drop-up": dropUp };
        const isFloating = { floating: floatingElements };
        const isLabelLess = { "labelless": labelLess };
        const limitWidth = { "limited-width": limitMenuWidth && open }
        const disconnected = { "dropdown-elements--disconnected": !!dropdownElementsPortalTarget };
        const classes = classnames(
            "dropdown-elements", isDropUp, isFloating, isLabelLess, limitWidth, elementsClassName, disconnected
        );
        const style = {
            maxHeight: this.getMaxHeight(maxRows),
            ...(dropdownElementsPortalTarget ? this.calculateAbsoluteListPosition() : {}),
        };
        const ul = (
            <ul className={classes} style={style}>
                {this.renderListItems()}
            </ul>
        );
        return dropdownElementsPortalTarget ?
            ReactDOM.createPortal(ul, dropdownElementsPortalTarget) :
            ul;
    }

    private renderListItems() {
        const { selectedElementId, elements } = this.state;
        const { hideSelectedElementInList, unselectable, type } = this.props;

        const maybeFilterSelectedElement = (toFilter: IDropdownElement[]) => {
            return hideSelectedElementInList ?
                toFilter.filter(el => el.id !== selectedElementId) :
                toFilter;
        };

        const listItems = maybeFilterSelectedElement(elements).map((element: IDropdownElement, i: number) => (
            <DropDownElement
                key={`litm${element.id}-${i}`}
                element={element}
                onElementClick={this.onSelectElement}
            />
        ));
        if (unselectable && selectedElementId) {
            listItems.unshift(
                <DropDownElement
                    key="litm-unsel"
                    element={{ id: "", label: type }}
                    onElementClick={this.onSelectElement}
                />
            )
        }
        return this.mergeHorizontalRules(listItems);
    }

    private calculateAbsoluteListPosition(): CSSProperties {
        const ddBoundingClientRect = (this.props.dropdownRef || this.dropdown)?.getBoundingClientRect();
        return {
            left: ddBoundingClientRect?.left,
            ...(this.props.dropUp ?
                {
                    bottom: window.innerHeight - ddBoundingClientRect?.top,
                } :
                { top: ddBoundingClientRect?.top + ddBoundingClientRect?.height }),
        }
    }

    private close() {
        this.setState({
            open: false,
        });
    }

    private onClick() {
        this.setState({
            open: !this.state.open,
        });
        if (typeof this.props.onClick === "function") {
            this.props.onClick();
        }
    }
    private mergeHorizontalRules(listItems) {
        const { horizontalRulePositions: positions } = this.props;
        return !positions ?
            listItems :
            listItems.map((listItem, i) => ([
                listItem,
                positions.indexOf(i + 1) >= 0 && <hr key={`hr${listItem.key}`} />,
            ]));
    }

    private getMaxHeight(maxRows) {
        return this.props.maxHeight || (maxRows ? maxRows * 36 : 30000);
    }

    private onSelectElement(id: string | number) {
        const { onSelectElement, unselectableElements } = this.props;
        if (onSelectElement) {
            onSelectElement(id);
        }
        this.setState({
            open: false,
            ...(unselectableElements ? {} : { selectedElementId: id }),
        });
    }
}

export default Dropdown;
