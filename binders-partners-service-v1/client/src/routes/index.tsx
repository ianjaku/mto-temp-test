import * as React from "react";
import { AZURE_AD_SSO_ROUTE, AzureADSSORoutes } from "../azure-ad-sso/routes";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { TRANSACTABLE_OFFERS_ROUTE, TransactableOffersRoutes} from "../transactable_offers/routes";
import { Fallback as FallbackComponent } from "../fallback/Fallback";

const router: React.FC = () => (
    <BrowserRouter>
        <Switch>
            <Route path={AZURE_AD_SSO_ROUTE} component={AzureADSSORoutes} />
            <Route path={TRANSACTABLE_OFFERS_ROUTE} component={TransactableOffersRoutes} />
            <Route path="*" component={(props) => Fallback(props)} />
        </Switch>
    </BrowserRouter>
)

const Fallback = (props) => (
    <FallbackComponent {...props} notFound={true} />
)

export default router;
