import * as React from "react";
import { BoxFooter } from "../components/generic-box/box-footer/BoxFooter";
import { BoxHeader } from "../components/generic-box/box-header/BoxHeader";
import { GenericBox } from "../components/generic-box/GenericBox";

import "./fallback.styl";

export function Fallback() {
    return (
        <GenericBox>
            <BoxHeader>404 Not Found</BoxHeader>
            <p className="fallback-paragraph">
                It seems that page for could not be found.
            </p>
            <p className="fallback-paragraph">
                Our apologies for any inconvenience.
            </p>
            <BoxFooter />
        </GenericBox>
    )
}