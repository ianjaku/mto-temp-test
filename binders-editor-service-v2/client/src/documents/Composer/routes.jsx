import * as React from "react";
import { Route, Switch } from "react-router-dom";
import Composer from ".";
import { ComposerContextProvider } from "./contexts/composerContext";

export const COMPOSER_ROUTE = "/documents";

const ComposerWithContext = (props) => {
    return (
        <ComposerContextProvider>
            <Composer {...props} />
        </ComposerContextProvider>
    );
}

export const ComposerRouter = () => (
    <Switch>
        <Route path={`${COMPOSER_ROUTE}/*/:collectionId/:binderId`} component={ComposerWithContext} />
        <Route path={`${COMPOSER_ROUTE}/:collectionId/:binderId`} component={ComposerWithContext} />
        <Route path={`${COMPOSER_ROUTE}/:binderId`} component={ComposerWithContext} />
    </Switch>
);
