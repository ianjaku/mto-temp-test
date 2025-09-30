import * as React from "react";
import { ErrorFullPage } from "../lazy/Error";
import { Lazy } from "../lazy";
import { LoadingFullPage } from "../lazy/Loading";

const LazyCollectionBrowser = React.lazy(() => import("./collection-browser"));

export const CollectionBrowser:React.FC<React.ComponentProps<typeof LazyCollectionBrowser>> = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyCollectionBrowser {...props} />
    </Lazy>
);

export default CollectionBrowser;