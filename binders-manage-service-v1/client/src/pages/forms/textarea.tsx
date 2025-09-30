import * as React from "react";
import { Textarea } from "../../components/textarea";
import { cn } from "../../cn";

export interface TextAreaRowProps {
    placeholder?: string;
    disabled?: boolean;
    changeHandler: (value: string) => void;
    labelClassName?: string;
    tag: string;
    value: string;
    cols?: number;
    rows?: number;
    label?: string;
    subLabel?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TextAreaRowState {
}

export class TextAreaRow extends React.Component<TextAreaRowProps, TextAreaRowState> {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.onChange = this.onChange.bind(this);
    }

    static defaultProps = {
        initialValue: "",
        placeHolder: "",
        disabled: false,
        value: "",
    };

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onChange(event): void {
        this.props.changeHandler(event.target.value);
    }

    render(): JSX.Element {
        const { disabled, value, rows, placeholder } = this.props;
        return <>
            {this.props?.label && (
                <div className={cn("flex flex-col items-end self-start", this.props.labelClassName)}>
                    {this.props.label}
                    {this.props.subLabel && (
                        <div className="text-sm text-muted-foreground">
                            {this.props.subLabel}
                        </div>
                    )}
                </div>
            )}
            <Textarea
                className="bg-white py-1 px-3 h-auto"
                rows={rows || 6}
                placeholder={placeholder}
                onChange={this.onChange}
                disabled={disabled}
                value={value} />
        </>
    }
}

