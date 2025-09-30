import * as React from "react";
import debounce from "lodash.debounce";

interface ISmallestFontSizeWrapperProps {
    totalItems: number;
}

interface ISmallestFontSizeWrapperState {
    smallestTitleFontSize: number;
    isFirstCalculation: boolean;
}

interface ISmallestFontSizeContext {
    titleFontSize: number;
    isFirstCalculation: boolean;
    onFinishCalculation: (fontSize: number) => void;
}

export const MAX_TITLE_FONTSIZE = 24;
export const MIN_TITLE_FONTSIZE = 12;

export const SmallestFontSizeContext = React.createContext<ISmallestFontSizeContext>({
    titleFontSize: MIN_TITLE_FONTSIZE,
    isFirstCalculation: true,
    onFinishCalculation: () => undefined,
})

class SmallestFontSizeWrapper extends React.Component<ISmallestFontSizeWrapperProps, ISmallestFontSizeWrapperState>  {
    private onResize: () => void;
    private calculatedItems = 0;
    private tempSmallestFontSize = MAX_TITLE_FONTSIZE;
    private fontSizeChangedCount = 0;

    constructor(props: ISmallestFontSizeWrapperProps) {
        super(props);

        this.checkIfSmallestFontSize = this.checkIfSmallestFontSize.bind(this);

        this.state = {
            smallestTitleFontSize: MAX_TITLE_FONTSIZE,
            isFirstCalculation: true
        };
    }

    private checkIfSmallestFontSize(fontSize: number) {
        this.calculatedItems ++;

        if (fontSize < this.tempSmallestFontSize) {
            this.tempSmallestFontSize = fontSize;
        }

        if (this.calculatedItems >= this.props.totalItems) {
            this.setState({
                isFirstCalculation: this.fontSizeChangedCount == 0,
                smallestTitleFontSize: Math.max(
                    this.tempSmallestFontSize,
                    MIN_TITLE_FONTSIZE
                )
            });
            this.fontSizeChangedCount ++;
        }
    }

    componentDidMount(): void {
        this.onResize = debounce(() => {
            this.tempSmallestFontSize = MAX_TITLE_FONTSIZE;
            this.calculatedItems -= this.props.totalItems;
        }, 240)
        window.addEventListener("resize", this.onResize)
    }

    componentWillUnmount(): void {
        window.removeEventListener("resize", this.onResize)
    }

    render(): React.ReactNode {
        const { children } = this.props;
        const { smallestTitleFontSize, isFirstCalculation } = this.state;

        return (
            <SmallestFontSizeContext.Provider value={{
                titleFontSize: smallestTitleFontSize,
                onFinishCalculation: this.checkIfSmallestFontSize.bind(this),
                isFirstCalculation,
            }}>
                {children}
            </SmallestFontSizeContext.Provider>
        );
    }
}

export default SmallestFontSizeWrapper;