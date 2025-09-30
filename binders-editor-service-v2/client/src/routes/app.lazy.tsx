import * as React from "react";
import { ErrorFullPage } from "../lazy/Error";
import { Lazy } from "../lazy";
import { LoadingFullPage } from "../lazy/Loading";
const LazyAppRouter = React.lazy(() => import("./app"));

export const AppRouter = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyAppRouter {...props} />
    </Lazy>
);

export default AppRouter;
