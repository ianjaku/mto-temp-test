import * as React from "react";
import * as ReactDOM from "react-dom";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { App } from "./modules/application/app.lazy";
import Login from "./modules/login/login.lazy";
import { ReactQueryProvider } from "./react-query";
import ThemeProvider from "@binders/ui-kit/lib/theme";
import "./assets/application/index.styl";

ReactDOM.render(
    <ReactQueryProvider>
        <ThemeProvider>
            <BrowserRouter>
                <Switch>
                    <Route path="/login" component={Login} />
                    <Route path="/" component={App} />
                </Switch>
            </BrowserRouter>
        </ThemeProvider>
    </ReactQueryProvider>,
    document.getElementById("react-main"),
);
