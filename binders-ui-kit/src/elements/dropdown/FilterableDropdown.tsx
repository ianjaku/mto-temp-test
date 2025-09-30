import * as React from "react";
import { IDropdownElement, IDropdownProps } from "./index";
import { equals, omit } from "ramda";
import Dropdown from "./";
import DropdownArrow from "../icons/DropdownArrow";
import DropupArrow from "../icons/DropupArrow";
import Input from "../input";
import autobind from "class-autobind";
import cx from "classnames";
import "./filterabledropdown.styl";

export interface IFilterableDropdownProps extends IDropdownProps {
    defaultOpened?: boolean;
    selectedElementId?: string | number;
    keepOpen?: boolean;
    isDisabled?: boolean;
    onTextChange?: (text: string) => void;
    setRef?: (ref) => void;
    dropdownElementsPortalTarget?: HTMLElement;
}

export interface IFilterableDropdownState {
    prevPropsElements: IDropdownElement[];
    elements: IDropdownElement[];
    isOpen?: boolean;
    value?: string;
    selectedElementId?: string | number;
}

class FilterableDropdown extends React.Component<IFilterableDropdownProps, IFilterableDropdownState> {

    private input;

    constructor(props: IFilterableDropdownProps) {
        super(props);
        autobind(this, FilterableDropdown.prototype);
        this.state = {
            prevPropsElements: props.elements,
            elements: props.elements,
            isOpen: props.defaultOpened,
            selectedElementId: props.selectedElementId,
            value: undefined,
        };
    }

    public componentDidMount(): void {
        if (this.props.defaultOpened && this.input) {
            setTimeout(() => this.input.focus(), 50);
        }
    }

    public componentDidUpdate(): void {
        const { selectedElementId, elements } = this.props;
        const { selectedElementId: stateSelectedElementId, prevPropsElements: stateElements, value } = this.state;
        const selectedElementIdChanged = selectedElementId !== undefined && (selectedElementId !== stateSelectedElementId);
        const elementsChanged = (elements || []).length && !equals(elements, stateElements);

        let stateUpdates = {};

        if (selectedElementIdChanged) {
            stateUpdates = {
                ...stateUpdates,
                selectedElementId,
                value: elements.find(el => el.id === selectedElementId)?.label || "",
            }
        }
        if (elementsChanged) {
            stateUpdates = {
                ...stateUpdates,
                elements: this.filterElements(elements, value),
                prevPropsElements: elements
            }
        }
        if (Object.keys(stateUpdates).length > 0) {
            this.setState(stateUpdates);
        }
    }

    private onKeyUp({ key }: { key: string }) {
        if (key === "Enter") {
            const { onSelectElement } = this.props;
            const { elements } = this.state;
            const selectedElement = elements.length > 0 && elements[0];
            if (onSelectElement) {
                onSelectElement(selectedElement ? selectedElement.id : undefined);
            }
            this.setState({
                isOpen: false,
                value: (selectedElement ? selectedElement.label : ""),
            });
        }
    }

    private onSelectElement(id: string) {
        const { onSelectElement } = this.props;
        if (onSelectElement) {
            onSelectElement(id);
        }
        if (!id) {
            this.setState({ isOpen: false, value: "" })
            return;
        }
        this.setState({
            isOpen: false,
            value: this.state.elements.find(el => el.id === id).label,
        });
    }

    private renderArrow() {
        const { dropUp, isDisabled } = this.props;
        return !isDisabled && (
            <span className="filterable-dropdown-arrow" onClick={this.onClickArrow}>
                {
                    dropUp ?
                        <DropupArrow /> :
                        <DropdownArrow />
                }
            </span>
        );
    }

    public render(): React.ReactNode {
        const { className, type, style, isDisabled, setRef, dropdownElementsPortalTarget } = this.props;
        const { elements, isOpen } = this.state;
        const setInput = this.setInput.bind(this);

        const value = this.getInputValue();

        return (
            <div
                className={cx("filterable-dropdown", className, { "filterable-dropdown--isDisabled": isDisabled })}
                style={style}
                ref={ref => setRef && setRef(ref)}
            >
                <Input
                    setRef={setInput}
                    type="text"
                    value={value}
                    onChange={this.onChange}
                    onFocus={this.onFocusInput}
                    onClick={this.onFocusInput}
                    onBlur={this.onBlurInput}
                    onKeyUp={this.onKeyUp}
                    width={this.props.width}
                    className="filterable-dropdown-input"
                    placeholder={type}
                    autoComplete="disabled"
                />
                {this.renderArrow()}
                <Dropdown
                    {...omit(["style", "className"], this.props)}
                    elements={elements}
                    labelLess={true}
                    open={isOpen}
                    onSelectElement={this.onSelectElement}
                    className="filterable-dropdown-dropdown"
                    dropdownElementsPortalTarget={dropdownElementsPortalTarget}
                    dropdownRef={this.input}
                />
            </div>
        );
    }

    private getInputValue() {
        const { value, elements, selectedElementId } = this.state;
        if (value !== undefined) {
            return value;
        }
        if (!selectedElementId) {
            return "";
        }
        return elements.find(el => el.id === selectedElementId)?.label || "";
    }

    private filterElements(elements, filter) {
        if (!elements || filter === undefined) {
            return elements;
        }
        return elements.filter(el => el.label.toLowerCase().indexOf(filter.toLowerCase()) !== -1);
    }

    private onClickArrow() {
        this.setState({
            elements: this.props.elements,
            isOpen: !this.state.isOpen,
        });
    }

    private onFocusInput() {
        this.setState({
            elements: this.props.elements,
            isOpen: true,
        });
    }

    private onBlurInput() {
        this.setState({
            isOpen: false,
        });
    }

    private onChange(value) {
        const { elements, onTextChange } = this.props;
        if (onTextChange) {
            onTextChange(value);
        }
        this.setState({
            elements: this.filterElements(elements, value),
            isOpen: true,
            value,
        });
    }

    private setInput(ref) {
        this.input = ref;
    }


}

export default FilterableDropdown;
