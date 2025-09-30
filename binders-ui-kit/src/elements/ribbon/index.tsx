import * as React from "react";
import Close from "../icons/Close";
import cx from "classnames";
import "./ribbon.styl";

export enum RibbonType {
    INFO = 0,
    OVERKILL_WARNING = 1,
    CUSTOM = 2,
    WARNING = 3,
}

export interface IRibbonProps {
    type?: RibbonType;
    closeable?: boolean;
    onRequestClose?: () => void;
    translucent?: boolean;
    customClasses?: string | string[] | { [className: string]: boolean };
}

const getClassMapping = (ribbonType: RibbonType): string[] => {
    switch (ribbonType) {
        case RibbonType.INFO:
            return ["ribbon--info"];
        case RibbonType.WARNING:
            return ["ribbon--warning"];
        case RibbonType.OVERKILL_WARNING:
            return ["ribbon--overkill-warning"];
        case RibbonType.CUSTOM:
            return [];
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Ribbon extends React.Component<IRibbonProps, any> {

    static defaultProps: IRibbonProps = {
        type: RibbonType.INFO
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
    }

    public render(): JSX.Element {
        const { children, type, closeable, onRequestClose, translucent, customClasses } = this.props;
        const typeClasses = getClassMapping(type);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isBlackBg = (window as any).bindersBranding?.stylusOverrideProps?.bgDark === "#000000";
        return (
            <div
                className={cx(
                    "ribbon",
                    typeClasses,
                    customClasses,
                    { "ribbon--translucent": translucent },
                    { "ribbon--forceWhiteContent": isBlackBg },
                )}
            >
                <div className="ribbon-body">
                    {children}
                </div>
                {
                    closeable ?
                        (
                            <label className="ribbon-closebtn" onClick={onRequestClose}>
                                {Close({ fontSize: "20px", width: "20px", height: "20px" })}
                            </label>
                        ) :
                        null
                }
            </div>
        );
    }
}

export default Ribbon;
