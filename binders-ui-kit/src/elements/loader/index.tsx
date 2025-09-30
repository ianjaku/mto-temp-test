// https://github.com/tobiasahlin/SpinKit
// Copyright (c) 2015 Tobias Ahlin, modified by Maxim Geerinck
import * as React from "react";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "../circularprogress";
import colors from "../../variables";
import i18next from "@binders/client/lib/react/i18n";
import "./loader.styl";

interface ILoaderProps {
    text?: string;
    className?: string;
    textEnabled?: boolean;
}

const defaultStyle = {
    color: colors.accentColor,
    left: 0,
    margin: "20px auto",
    position: "relative",
    top: 0,
    transform: undefined,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Loader extends React.Component<ILoaderProps, any> {
    public static defaultProps = {
        className: "",
        text: `${i18next.t(TranslationKeys.General_Loading)}...`,
        textEnabled: true,
    };

    public render(): JSX.Element {
        const { text, className, textEnabled } = this.props;
        return (
            <div className={`loader ${className}`}>
                <div>
                    {circularProgress("", defaultStyle, 20)}
                </div>
                {textEnabled && <span>{text}</span>}
            </div>
        );
    }
}


export default Loader;
