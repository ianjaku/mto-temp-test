import * as React from "react";
import { ErrorFullPage } from "../lazy/Error";
import { Lazy } from "../lazy";
import { LoadingFullPage } from "../lazy/Loading";
import type { ReaderPreferencesProps } from "./readerpreferences";

const LazyReaderPreferences = React.lazy(() => import("./readerpreferences"));

export const ReaderPreferences: React.FC<ReaderPreferencesProps> = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyReaderPreferences {...props} />
    </Lazy>
);

export default ReaderPreferences;