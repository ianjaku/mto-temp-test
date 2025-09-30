import * as React from "react";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import { RouteComponentProps } from "react-router-dom";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import UserDetails from "./userdetails";
import UserPassword from "./userpassword";
import { getImpersonationInfo } from "@binders/client/lib/util/impersonation";
import { toFullPath } from "../../util";
import { useUserStoreState } from "../../stores/zustand/user-store";

export interface UserInfoPaneProps {
    router: RouteComponentProps;
    userDetails: User;
    accountId: string;
}

const UserInfoPane: React.FC<UserInfoPaneProps> = (props) => {
    const impersonationInfo = getImpersonationInfo();
    const isDeviceUserTarget = impersonationInfo ? !!(impersonationInfo.isDeviceUserTarget) : undefined;
    const isAllowedToChangePassword = useUserStoreState(state => state.isAllowedToChangePassword);

    React.useEffect(() => {
        if (isDeviceUserTarget) {
            props.router.history.push(toFullPath(`${ManualToRoutes.USER_SETTINGS}/reader`, { includeCurrentQueryString: true }));
        }
    }, [isDeviceUserTarget, props.router]);

    if (isDeviceUserTarget !== false) {
        return null;
    }

    return (
        <div>
            <UserDetails userDetails={props.userDetails} accountId={props.accountId} />
            {isAllowedToChangePassword ? <UserPassword user={props.userDetails}/> : null}
        </div>
    );
};

export default UserInfoPane;
