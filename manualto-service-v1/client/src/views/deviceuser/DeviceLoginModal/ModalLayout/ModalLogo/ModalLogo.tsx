import * as React from "react";
import { FC } from "react";
import { getReaderDomain } from "../../../../../util";
import "./ModalLogo.styl"; 


export const ModalLogo: FC = () => {
    const logoUrl = window.bindersBranding?.logo?.url;
    const domainName = getReaderDomain().split(".")[0] + ".";
    const domainSuffix = getReaderDomain().replace(domainName, "");
    
    if (logoUrl != null) {
        return <img src={logoUrl} className="modalLogo--image" />;
    }
    return (
        <div className="modalLogo--domain">
            <span className="modalLogo--domain-name">{domainName}</span>
            <span className="modalLogo--domain-suffix">{domainSuffix}</span>
        </div>
    );
}
