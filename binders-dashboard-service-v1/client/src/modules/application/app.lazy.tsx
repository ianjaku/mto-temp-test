import * as React from "react";
import { ErrorFullPage } from "../../lazy/Error";
import { Lazy } from "../../lazy";
import { LoadingFullPage } from "../../lazy/Loading";

const LazyApp = React.lazy(() => import("./app"));

export const App: () => JSX.Element = () => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyApp />
    </Lazy>
);

export default App;
