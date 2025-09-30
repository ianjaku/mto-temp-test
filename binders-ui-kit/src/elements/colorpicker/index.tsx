import * as React from "react";
import ReactColorPicker from "rc-color-picker";
import classnames from "classnames";
import colors from "../../variables";
import debounce from "lodash.debounce";
import "./colorpicker.styl";

export interface IColorPickerProps {
    onColorSelect: (hexColor) => void;
    defaultHexColor?: string;
    renderFunction?: (selectedHexColor: string, setColor: (color: string) => void) => JSX.Element;
}

export interface IColorPickerState {
    defaultHexColor: string;
    selectedHexColor: string;
    bumpable: number;
}

class ColorPicker extends React.Component<IColorPickerProps, IColorPickerState> {

    private static getDerivedStateFromProps(nextProps, prevState) {
        const { defaultHexColor } = nextProps;
        if (defaultHexColor !== prevState.defaultHexColor) {
            return {
                defaultHexColor,
                selectedHexColor: defaultHexColor || colors.thumbBackgroundColor,
            };
        }
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.onColorChange = this.onColorChange.bind(this);
        this.onColorSelect = this.onColorSelect.bind(this);
        this.onScroll = debounce(this.onScroll.bind(this), 100);
        this.state = {
            defaultHexColor: props.defaultHexColor,
            selectedHexColor: props.defaultHexColor || colors.thumbBackgroundColor,
            bumpable: 0,
        };
    }

    public componentDidMount(): void {
        window.addEventListener("scroll", this.onScroll)
    }

    public componentWillUnmount(): void {
        this.removeListeners();
        this.flushPendingColorSelect();
    }

    private flushPendingColorSelect = () => {
        const { onColorSelect } = this.props;
        const { selectedHexColor, defaultHexColor } = this.state;
        if (onColorSelect && selectedHexColor !== defaultHexColor) {
            onColorSelect(selectedHexColor);
        }
    };

    listenForColorChange = (): void => {
        setTimeout(() => {
            const input = document.getElementsByClassName("rc-color-picker-panel-params-hex")[0];
            input.addEventListener("keyup", (e: KeyboardEvent) => {
                if (e.key === "Control" || (e.ctrlKey && e.key === "a")) {
                    return;
                }
                const inputted = (e.target as HTMLInputElement).value;
                const potentialHex = `#${inputted}`;
                const validHex = potentialHex.match(/^#([A-Fa-f0-9]{6})$/);
                if (validHex) {
                    this.setState({
                        selectedHexColor: potentialHex,
                        bumpable: this.state.bumpable + 1,
                    }, () => {
                        this.onColorSelect();
                    });
                }
            });
        });
    }

    removeListeners = (): void => {
        window.removeEventListener("scroll", this.onScroll);
        const input = document.getElementsByClassName("rc-color-picker-panel-params-hex")[0];
        if (input) {
            input.removeEventListener("keyup", () => { });
        }
    }

    public render(): JSX.Element {
        const { selectedHexColor, bumpable } = this.state;
        const setColorFromInput = (newColor: string) => {
            this.setState({
                selectedHexColor: newColor
            }, () => {
                // Also trigger onColorSelect to persist the change
                if (this.props.onColorSelect) {
                    this.props.onColorSelect(newColor);
                }
            });
        };
        return (
            <ReactColorPicker
                key={bumpable} // This causes a rerender, ideally to update the component with a new color, but in practise it just closes the modal (context: MT-3237)
                color={selectedHexColor}
                placement="topRight"
                onChange={this.onColorChange}
                onOpen={this.listenForColorChange}
                onClose={this.onColorSelect}
                enableAlpha={false}
            >
                {this.props.renderFunction ?
                    <div className="colorpicker-custom-wrapper">
                        {this.props.renderFunction(selectedHexColor, setColorFromInput)}
                    </div> :
                    (
                        <div className="colorpicker">
                            <div>
                                <label className="colorpicker-label">{selectedHexColor}</label>
                            </div>
                            <div className={classnames("colorpicker-swatch", "react-custom-trigger")} style={{ backgroundColor: selectedHexColor }} />
                        </div>
                    )}
            </ReactColorPicker>
        );
    }

    private onScroll() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const panel = (document.getElementsByClassName("rc-color-picker-panel")[0] as any);
        if (panel) {
            panel.blur();
        }
    }

    private onColorChange(e) {
        this.setState({
            selectedHexColor: e.color,
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private onColorSelect() {
        const { onColorSelect } = this.props;
        if (onColorSelect) {
            onColorSelect(this.state.selectedHexColor);
        }
    }
}

export default ColorPicker;
