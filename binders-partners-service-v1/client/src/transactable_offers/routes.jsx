import * as React from "react";
import { Route, Switch } from "react-router-dom";
import { AzureADSSOProvider } from "../azure-ad-sso/AzureADSSOProvider";
import { LandingPage } from "./LandingPage/LandingPage";

export const TRANSACTABLE_OFFERS_ROUTE = "/transactable-offers";

export const TransactableOffersRoutes = () => (
    <AzureADSSOProvider>
        <Switch>
            <Route path={`${TRANSACTABLE_OFFERS_ROUTE}`} component={LandingPage} />
        </Switch>
    </AzureADSSOProvider>
);
