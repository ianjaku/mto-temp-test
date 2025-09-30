// https://github.com/tobiasahlin/SpinKit
// Copyright (c) 2015 Tobias Ahlin, modified by Maxim Geerinck
import * as React from "react";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import i18next from "@binders/client/lib/react/i18n";
import "./loader.styl";
const { useEffect, useMemo, useState } = React;

interface IProps {
    text?: string;
    partialScreen?: boolean;
    className?: string;
    appearDelayMs?: number;
    doFade?: boolean;
}

const Loader: React.FC<IProps> = ({ text, partialScreen, className, doFade, appearDelayMs }) => {

    const loaderText = useMemo(() => (
        text === undefined ? `${i18next.t(TranslationKeys.General_Loading)}...` : text
    ), [text]);

    const [visible, setVisible] = useState(false);

    const classes = useMemo(() =>
        cx(
            `loader${partialScreen ? "" : " fullscreen"}`,
            className,
            { "loader-doFade": doFade },
            { "loader-visible": visible },
        ), [partialScreen, className, visible, doFade]);

    useEffect(() => {
        if (!visible) {
            const t = setTimeout(() => setVisible(true), appearDelayMs || 0);
            return () => clearTimeout(t);
        }
    }, [visible, appearDelayMs]);

    return (
        <div className={classes}>
            <div className="sk-folding-cube">
                <div className="sk-cube1 sk-cube" />
                <div className="sk-cube2 sk-cube" />
                <div className="sk-cube4 sk-cube" />
                <div className="sk-cube3 sk-cube" />
            </div>
            <span>{loaderText}</span>
        </div>
    );
}

export default Loader;
