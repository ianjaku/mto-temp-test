import * as React from "react";
import { AzureADSSOProvider } from "./AzureADSSOProvider";
import { FC } from "react";

export const SSORedirectPage: FC = () => {
    return (
        <AzureADSSOProvider />
    );
}
