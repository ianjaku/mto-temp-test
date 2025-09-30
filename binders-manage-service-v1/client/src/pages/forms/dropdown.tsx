import * as React from "react";

export interface DropdownProps {
    initialValue?: string;
    disabled?: boolean;
    changeHandler: (value: string) => void;
    label: string;
    // eslint-disable-next-line @typescript-eslint/ban-types
    options: Object;
}

export interface DropdownState {
    inputValue: string;
}

export class DropdownRow extends React.Component<DropdownProps, DropdownState> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.state = {
            inputValue: this.props.initialValue
        };
    }

    componentDidUpdate(prevProps: DropdownProps): void {
        const { initialValue: prevInitialValue } = prevProps;
        const { initialValue } = this.props;
        if (initialValue !== prevInitialValue) {
            this.setState({
                inputValue: initialValue,
            })
        }
    }

    static defaultProps = {
        initialValue: "",
        disabled: false
    };

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    handleChange(event): void {
        const newValue = event.target.value;
        this.setState({ inputValue: newValue } as DropdownState);
        this.props.changeHandler(newValue);
    }

    render(): JSX.Element {
        const options = Object.keys(this.props.options).map(key => {
            return <option key={key} value={key}>{this.props.options[key]}</option>;
        });
        return <>
            <div className="">{this.props.label}</div>
            <select
                className={`
                    w-full block py-1 px-3
                    bg-white border border-gray-300
                    text-foreground text-md rounded-sm
                    focus:ring-accent focus:border-accent
                `}
                value={this.state.inputValue} onChange={this.handleChange.bind(this)}>
                {options}
            </select>
        </>;
    }
}
