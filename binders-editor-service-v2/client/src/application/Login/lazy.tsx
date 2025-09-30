import * as React from "react";
import { ErrorFullPage } from "../../lazy/Error";
import { Lazy } from "../../lazy";
import { LoadingFullPage } from "../../lazy/Loading";
const LazyLogin = React.lazy(() => import("./index"));

export const Login = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyLogin {...props} />
    </Lazy>
);

export default Login;
