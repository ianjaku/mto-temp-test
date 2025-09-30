import * as React from "react";
import { ErrorFullPage } from "../lazy/Error";
import { Lazy } from "../lazy";
import { LoadingFullPage } from "../lazy/Loading";
import { ReaderProps } from "./reader";

const LazyReader = React.lazy(() => import("./reader"));

export const Reader: React.FC<ReaderProps> = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyReader {...props} />
    </Lazy>
);

export default Reader;
