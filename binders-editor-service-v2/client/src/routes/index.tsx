import * as React from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { AppRouter } from "./app";
import Login from "../application/Login";
import RequestResetPassword from "../application/RequestResetPassword";

const RootRouter = () => (
    <BrowserRouter>
        <Switch>
            <Route path="/reset-password" component={RequestResetPassword} />
            <Route path="/login" render={() => <Login />} />
            <Route path="/" render={AppRouter} />
        </Switch>
    </BrowserRouter>
)

export default RootRouter;
