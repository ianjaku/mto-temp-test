import * as React from "react";
import { use100vh } from "react-div-100vh";

export interface IDiv100VhProps {
    className: string;
    asMinHeight: boolean;
}

export const Div100Vh: React.FC<IDiv100VhProps> = ({children, className, asMinHeight}) => {
    const heigth100vh = use100vh();
    const height = heigth100vh ? heigth100vh - 1 : "100vh";
    return (
        <div style={asMinHeight ? {minHeight: height} : {height}} className={className}>
            {children}
        </div>
    )
}