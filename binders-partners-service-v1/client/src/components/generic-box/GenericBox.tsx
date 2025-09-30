import * as React from "react";
import { FC } from "react";
import "./generic-box.styl";

const BoxFooter: FC = () => (
    <footer className="generic-box-footer">
        <div className="generic-box-footer-row">
                    Binders Media
        </div>
        <div className="generic-box-footer-row">
                    BTW BE0657.817.970
        </div>
    </footer>
);

export const GenericBox: FC<{
    showCompanyInfo?: boolean
}> = ({
    children,
    showCompanyInfo = true
}) => {
    return (
        <div className="generic-box">
            <div className="generic-box-content">
                {children}
            </div>
            {showCompanyInfo && <BoxFooter />}
        </div>
    );
}
