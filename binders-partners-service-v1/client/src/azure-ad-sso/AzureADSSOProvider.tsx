import * as React from "react";
import { FC } from "react";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";

interface MSTransactableWindowConfig {
    azureSSOAppID: string;
    azureSSORedirectURI: string;
    azureSSOAuthority: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const msConfig: MSTransactableWindowConfig = (window as any).bindersConfig.msTransactableOffers;

const msalInstance = new PublicClientApplication({
    auth: {
        clientId: msConfig.azureSSOAppID,
        authority: msConfig.azureSSOAuthority,
        redirectUri: msConfig.azureSSORedirectURI
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    }
});

export const AzureADSSOProvider: FC = ({ children }) => {
    return (
        <MsalProvider instance={msalInstance}>
            {children}
        </MsalProvider>
    )
}
