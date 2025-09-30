import * as React from "react";
import { ErrorFullPage } from "../lazy/Error";
import { Lazy } from "../lazy";
import { LoadingFullPage } from "../lazy/Loading";
const LazyUserInfo = React.lazy(() => import("./userinfo"));

export const UserInfo: React.FC<React.ComponentProps<typeof LazyUserInfo>> = (props) => (
    <Lazy loading={<LoadingFullPage />} error={<ErrorFullPage />}>
        <LazyUserInfo {...props} />
    </Lazy>
);

export default UserInfo;