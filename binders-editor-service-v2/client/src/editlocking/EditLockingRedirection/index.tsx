import * as React from "react";
import { useClearRedirectionRequest, useRedirectWhenLocked } from "./hooks";

const EditLockingRedirection: React.FC = ({ children }) => {

    useClearRedirectionRequest();
    useRedirectWhenLocked();

    return <>{children}</>;
}

export default EditLockingRedirection;
