import * as React from "react";
import { ErrorFullPage } from "../lazy/Error";
import { Lazy } from "../lazy";
import { LoadingFullPage } from "../lazy/Loading";
const LazyTermsAndConditions = React.lazy(() => import("./termsAndConditions/index"));

export const TermsAndConditions: React.FC<React.ComponentProps<typeof LazyTermsAndConditions>> = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyTermsAndConditions {...props} />
    </Lazy>
);

export default TermsAndConditions;