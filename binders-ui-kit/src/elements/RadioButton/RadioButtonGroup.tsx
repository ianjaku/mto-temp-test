import * as React from "react";
import RadioGroup from "@material-ui/core/RadioGroup";


export interface IRadioButtonGroupProps {
    className?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children?: any;
    labelPosition?: string;
    name?: string;
    // eslint-disable-next-line @typescript-eslint/ban-types
    onChange?: (event: object, value: undefined) => void;
    inverted?: boolean;
    row?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class RadioButtonGroup extends React.Component<IRadioButtonGroupProps, any> {
    public render(): JSX.Element {
        const { inverted } = this.props;
        const children = React.Children.map(this.props.children, (child: React.ReactElement) => {
            if (child?.type !== "RadioButton") {
                return child;
            }
            return React.cloneElement(child, {
                ...child.props,
                inverted,
                row: undefined,
            });
        });

        return (
            <RadioGroup {...{ ...this.props, inverted: undefined }}>{children}</RadioGroup>
        );
    }
}

export default RadioButtonGroup;
