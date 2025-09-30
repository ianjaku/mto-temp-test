import * as React from "react";
import CheckBoxIcon from "@material-ui/icons/CheckBox";
import CheckBoxOutlineBlankIcon from "@material-ui/icons/CheckBoxOutlineBlank";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import MaterialCheckbox from "@material-ui/core/Checkbox";
import Tooltip from "@material-ui/core/Tooltip";

export interface ICheckboxState {
    checked: boolean;
}

class Checkbox extends React.Component<ICheckboxProps, ICheckboxState> {
    public static defaultProps: Partial<ICheckboxProps> = {
        checked: false,
        disabled: false,
        isControlled: false,
    };

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static getDerivedStateFromProps(nextProps, prevState) {
        const { checked } = prevState;
        const { isControlled } = nextProps;
        return isControlled && checked !== nextProps.checked ?
            { checked: nextProps.checked } :
            null;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.onChange = this.onChange.bind(this);
        this.renderMaterialCheckbox = this.renderMaterialCheckbox.bind(this);
        this.state = {
            checked: props.checked,
        };
    }

    public render(): JSX.Element {
        const { label, labelStyle, tooltip } = this.props;
        const component = !label ?
            this.renderMaterialCheckbox() :
            (
                <FormControlLabel
                    label={label}
                    control={this.renderMaterialCheckbox()}
                    style={labelStyle}
                    className="checkboxControlLabel"
                />
            );
        return tooltip ? <Tooltip title={tooltip} placement="bottom-start"><div>{component}</div></Tooltip> : component;
    }

    private renderMaterialCheckbox() {
        const { disabled, iconStyle, className, iconSize } = this.props;

        const { checked } = this.state;
        return (
            <MaterialCheckbox
                checked={checked}
                disabled={disabled}
                onChange={this.onChange}
                className={className}
                icon={<CheckBoxOutlineBlankIcon fontSize={iconSize || "small"} />}
                checkedIcon={<CheckBoxIcon style={iconStyle} fontSize={iconSize || "small"} />}
                color="primary"
            />
        );
    }

    private onChange(e) {
        const { onCheck } = this.props;
        const { checked } = e.target;

        this.setState({ checked }, () => {
            if (typeof onCheck === "function") {
                onCheck(checked);
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    componentDidUpdate(prevProps): void {
        if (prevProps.checked !== this.props.checked) {
            this.setState({
                checked: this.props.checked
            });
        }
    }

}

export interface ICheckboxProps {
    onChange?: (isChecked: boolean) => void;
    onCheck?: (isChecked: boolean) => void;
    label?: string;
    disabled?: boolean;
    checked?: boolean;
    // eslint-disable-next-line @typescript-eslint/ban-types
    iconStyle?: object;
    isControlled?: boolean;
    // eslint-disable-next-line @typescript-eslint/ban-types
    labelStyle?: object;
    onFocus?: (e) => void;
    // eslint-disable-next-line @typescript-eslint/ban-types
    style?: object;
    className?: string;
    tooltip?: string;
    iconSize?: "default" | "inherit" | "large" | "medium" | "small";
}

export default Checkbox;
