import * as React from "react";
import { ErrorFullPage } from "../lazy/Error";
import { Lazy } from "../lazy";
import { LoadingFullPage } from "../lazy/Loading";
const LazyPublicApiSettings = React.lazy(() => import("./publicapi"));

export const PublicApiSettings: React.FC<React.ComponentProps<typeof LazyPublicApiSettings>> = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyPublicApiSettings {...props} />
    </Lazy>
);

export default PublicApiSettings;