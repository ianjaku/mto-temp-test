import * as React from "react";
import Close from "../icons/Close";
import Done from "../icons/Done";
import ErrorOutline from "../icons/ErrorOutline";
import InfoOutline from "../icons/InfoOutline";
import cx from "classnames";
import "./flashmessage.styl";

export interface IFlashMessageProps {
    type: FlashMessageType;
    message: string;
    open: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onHide?: () => any;
    autoHideDuration?: number;
    setTimerHandle?: (timerHandle) => void;
    keepOpen?: boolean;
}

export interface IFlashMessageState {
    open: boolean;
    shouldSetTimerHandler: boolean;
    autoHideDuration: number;
}

class FlashMessage extends React.Component<IFlashMessageProps, IFlashMessageState> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static getDerivedStateFromProps(
        nextProps: IFlashMessageProps,
        prevState: IFlashMessageState
    ) {
        if (nextProps.open !== prevState.open) {
            return {
                open: nextProps.open,
                shouldSetTimerHandler: true,
            };
        }
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.handleRequestClose = this.handleRequestClose.bind(this);
        this.getTypeClass = this.getTypeClass.bind(this);

        this.state = {
            autoHideDuration: props.autoHideDuration || 4000,
            open: props.open,
            shouldSetTimerHandler: false,
        };
    }

    public componentDidUpdate(): void {
        const { autoHideDuration, shouldSetTimerHandler } = this.state;
        const { keepOpen, onHide, setTimerHandle } = this.props;

        if (shouldSetTimerHandler && !keepOpen) {
            const timerHandle = setTimeout(onHide, autoHideDuration);
            if (typeof setTimerHandle === "function") {
                setTimerHandle(timerHandle);
            }
            this.setState({ shouldSetTimerHandler: false });
        }
    }

    public render(): JSX.Element {
        const { open } = this.props;
        return (
            <div className={cx("flashmessage", open ? "open" : undefined, this.getTypeClass())}>
                <div className="icon">
                    {this.getTypeIcon()}
                </div>
                <label className="message" dangerouslySetInnerHTML={{__html:this.props.message}} />
                <label className="close" onClick={this.props.onHide}>
                    {Close({color: "inherit"})}
                </label>
            </div >
        );
    }

    private handleRequestClose() {
        this.setState({
            open: false,
        });
    }

    private getTypeClass() {
        switch (this.props.type) {
            case 0: return "success";
            case 2: return "error";
            default: return "info";
        }
    }

    private getTypeIcon() {
        switch (this.props.type) {
            case 0: return <Done />;
            case 2: return <ErrorOutline />;
            default: return <InfoOutline />;
        }
    }
}

export enum FlashMessageType {
    SUCCESS = 0,
    INFO = 1,
    ERROR = 2,
}

export default FlashMessage;
