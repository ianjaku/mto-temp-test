import * as React from "react";
import MaterialSlider from "@material-ui/core/Slider";
import "./slider.styl";

export interface ISliderProps {
    min?: number;
    max?: number;
    step?: number;
    value?: number;
    onChange: (value: number) => void;
}

export interface ISliderState {
    value: number;
}

class Slider extends React.Component<ISliderProps, ISliderState> {
    private static defaultProps = {
        max: 10,
        min: 0,
        step: 1,
    };

    constructor(props: ISliderProps) {
        super(props);
        this.onChange = this.onChange.bind(this);
        this.state = {
            value: props.value || props.min,
        };
    }

    public render(): JSX.Element {
        const { max, min, step } = this.props;
        const { value } = this.state;

        return (
            <div className="slider">
                <MaterialSlider
                    value={this.props.value || value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={this.onChange}
                />
            </div>
        );
    }

    private onChange(e, value) {
        const { onChange } = this.props;
        this.setState({ value }, () => onChange(value));
    }
}

export default Slider;