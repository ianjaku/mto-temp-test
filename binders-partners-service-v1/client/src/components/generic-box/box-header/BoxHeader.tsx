import * as React from "react";
import { FC } from "react";
import "./box-header.styl";

export const BoxHeader: FC = ({ children }) => {
    return (
        <header className="box-header">
            <h1 className="box-header-title">
                {children}
            </h1>
            <div className="box-header-logo"></div>
        </header>
    )
}
