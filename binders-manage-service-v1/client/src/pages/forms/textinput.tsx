import * as React from "react";
import { Input } from "../../components/input";
import { Textarea } from "../../components/textarea";
import { cn } from "../../cn";

export interface TextInputRowProps<T> {
    initialValue?: T;
    placeholder?: string;
    disabled?: boolean;
    labelClassName?: string;
    inputType?: "text" | "text-multiline" | "password" | "number" | "datetime-local";
    changeHandler: (value: T) => void;
    label: string;
    subLabel?: string;
    name?: string;
}

export interface TextInputRowState<T> {
    inputValue: T;
}

export class TextInputRow<T extends string | number = string> extends React.Component<TextInputRowProps<T>, TextInputRowState<T>> {

    constructor(props: TextInputRowProps<T>) {
        super(props);
        this.state = {
            inputValue: props.initialValue,
        };
    }

    static defaultProps = {
        initialValue: "",
        placeHolder: "",
        disabled: false,
        inputType: "text"
    };

    componentDidUpdate(prevProps: TextInputRowProps<T>): void {
        const { initialValue: prevInitialValue } = prevProps;
        const { initialValue } = this.props;
        if (initialValue !== prevInitialValue) {
            this.setState({
                inputValue: initialValue,
            })
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    handleValueChange(event): void {
        const newValue = event.target.value;
        this.setState({ inputValue: newValue });
        this.props.changeHandler(newValue);
    }

    render(): React.ReactNode {
        return (
            <>
                <label htmlFor={this.props.name} className={cn("flex flex-col items-end", this.props.labelClassName)}>
                    {this.props.label}
                    {this.props.subLabel && (
                        <span className="text-sm text-muted-foreground">
                            {this.props.subLabel}
                        </span>
                    )}
                </label>
                {
                    this.props.inputType === "text-multiline" ?
                        (
                            <Textarea
                                className="bg-white py-1 px-3 h-auto"
                                placeholder={this.props.placeholder}
                                name={this.props.name}
                                value={this.state.inputValue as string | number}
                                onChange={this.handleValueChange.bind(this)}
                                disabled={this.props.disabled}
                                rows={5}
                            />
                        ) :
                        (
                            <Input
                                className="bg-white py-1 px-3 h-auto"
                                type={this.props.inputType}
                                name={this.props.name}
                                placeholder={this.props.placeholder}
                                value={this.state.inputValue as string | number}
                                onChange={this.handleValueChange.bind(this)}
                                disabled={this.props.disabled}
                                step="60"
                            />
                        )
                }
            </>
        );
    }
}
