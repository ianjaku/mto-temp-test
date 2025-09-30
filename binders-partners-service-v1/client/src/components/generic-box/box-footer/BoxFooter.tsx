import * as React from "react";
import { FC } from "react";
import "./box-footer.styl";

export const BoxFooter: FC = () => {
    return (
        <footer className="box-footer">
            <a
                href="https://manual.to"
                target="_blank"
                rel="noreferrer"
                className="box-footer-item"
            >
                Manual.to
            </a>
            <a
                href="mailto:support@manual.to"
                className="box-footer-item"
            >
                support@manual.to
            </a>
            <a
                href="tel:+32472292053"
                className="box-footer-item"
            >
                +32 472 292 053
            </a>
        </footer>
    )
}
