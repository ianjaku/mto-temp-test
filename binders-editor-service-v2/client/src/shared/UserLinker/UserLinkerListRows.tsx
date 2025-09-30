import * as React from "react";
import { buildUserName, isUsergroup } from "@binders/client/lib/clients/userservice/v1/helpers";
import { useEffect, useState } from "react";
import UserRow from "./UserRow";
import { useUserLinkerContext } from "./userLinkerContext";

const UserLinkerListRows: React.FC = () => {
    const {
        findUsersAndGroups,
        linkedUserIds,
        onUnlinkUser,
    } = useUserLinkerContext();
    const [userRows, setUserRows] = useState<Array<{ label: string, id: string }>>([]);

    useEffect(() => {
        if (!(linkedUserIds || []).length) {
            return;
        }
        findUsersAndGroups(linkedUserIds).then(userOrGroup => {
            setUserRows(userOrGroup.map(u => {
                return {
                    label: isUsergroup(u) ? u.name : buildUserName(u),
                    id: u.id,
                };
            }));
        });
    }, [findUsersAndGroups, linkedUserIds]);

    return (
        <div className="userLinkerListRows">
            {userRows.map((userRow) => (
                <UserRow
                    key={userRow.id}
                    userRow={userRow}
                    onUnlinkUser={onUnlinkUser}
                />
            ))}
        </div>
    )
}

export default UserLinkerListRows;
