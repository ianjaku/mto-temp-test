import * as React from "react";
import { ErrorFullPage } from "../../lazy/Error";
import { Lazy } from "../../lazy";
import { LoadingFullPage } from "../../lazy/Loading";

const LazyLogin = React.lazy(() => import("./login"));

export const Login: () => JSX.Element = () => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyLogin />
    </Lazy>
);

export default Login;
