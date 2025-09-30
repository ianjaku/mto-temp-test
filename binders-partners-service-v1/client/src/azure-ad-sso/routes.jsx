import * as React from "react";
import { Route, Switch } from "react-router-dom";
import { AzureADSSOProvider } from "./AzureADSSOProvider";
import { SSORedirectPage } from "./RedirectPage";

export const AZURE_AD_SSO_ROUTE = "/azure-ad-sso";

export const AzureADSSORoutes = () => (
    <AzureADSSOProvider>
        <Switch>
            <Route path={`${AZURE_AD_SSO_ROUTE}/redirect`} component={SSORedirectPage} />
        </Switch>
    </AzureADSSOProvider>
);
