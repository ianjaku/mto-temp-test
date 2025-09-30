import * as React from "react";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import UserLinkerAdd from "./UserLinkerAdd";
import UserLinkerList from "./UserLinkerList";
import cx from "classnames";
import { useEffect } from "react";
import { useUserLinkerContext } from "./userLinkerContext";
import "./userLinker.styl";

const UserLinker: React.FC = () => {
    const {
        isLoading,
        linkedUserIds,
        linkedUsergroupIntersections,
        setUserLookupList,
        usernameLookupList,
    } = useUserLinkerContext();

    useEffect(() => setUserLookupList(usernameLookupList), [usernameLookupList, setUserLookupList]);

    return (
        <div className={cx("userLinker", "userLinker--tighterLayout")}>
            <UserLinkerAdd />
            {linkedUserIds.length + linkedUsergroupIntersections.length ?
                <UserLinkerList /> :
                null}
            {isLoading ?
                (
                    <div className="userLinker-loadingBlanket">
                        {CircularProgress()}
                    </div>
                ) :
                null}
        </div>
    )
}

export default UserLinker;
