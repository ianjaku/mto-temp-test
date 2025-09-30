import * as PropTypes from "prop-types";
import * as React from "react";
import autobind from "class-autobind";

import "./input.styl";
 
export class Input extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            value: this.props.value
        };
        autobind(this);
    }

    onChange(event) {
        const newValue = event.target.value;
        this.setState({value: newValue});
        if (this.props.onChange) {
            if (this.props.type === "radio") {
                this.props.onChange(this.props.value);
            }
            else {
                this.props.onChange(newValue);
            }
        }
    }

    render() {
        const extraClassName = this.props.className ? this.props.className : "";
        let extraProps = {};
        if (this.props.type === "radio") {
            extraProps.checked = this.props.isSelected;
        }
        return <input 
            className={"element-input " + extraClassName}
            placeholder={this.props.placeholder}
            type={this.props.type}
            onChange={this.onChange}
            onKeyDown={e => {
                if (e.key === "Enter") {
                    this.props.onEnterKey?.();
                }
            }}
            {...extraProps}
            name={this.props.name}
            value={this.props.value}
        />;
    }
}

Input.propTypes = {
    className: PropTypes.string,
    name: PropTypes.string,
    onChange: PropTypes.func,
    onEnterKey: PropTypes.func,
    placeholder: PropTypes.string,
    type: PropTypes.string,
};