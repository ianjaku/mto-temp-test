import * as React from "react";
import { ErrorFullPage } from "../lazy/Error";
import { Lazy } from "../lazy";
import { LoadingFullPage } from "../lazy/Loading";
const LazyPrivacySettings = React.lazy(() => import("./privacy"));

export const PrivacySettings:React.FC<React.ComponentProps<typeof LazyPrivacySettings>> = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyPrivacySettings {...props} />
    </Lazy>
);

export default PrivacySettings;
