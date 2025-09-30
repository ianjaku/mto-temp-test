import * as React from "react";
import { ErrorFullPage } from "../../lazy/Error";
import { Lazy } from "../../lazy";
import { LoadingFullPage } from "../../lazy/Loading";
const LazyRequestResetPassword = React.lazy(() => import("./index"));

export const RequestResetPassword = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyRequestResetPassword {...props} />
    </Lazy>
);

export default RequestResetPassword;
