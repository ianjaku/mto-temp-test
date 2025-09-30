import * as React from "react";
import { useCurrentUserId, useDeviceTargetUsers } from "../../../stores/hooks/user-hooks";
import { ModalLayout } from "./ModalLayout/ModalLayout";
import SearchInput from "@binders/ui-kit/lib/elements/input/SearchInput";
import { TargetList } from "./TargetList/TargetList";
import type { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { useHasOpenModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useSortedDeviceTargetUsers } from "./hooks/useSortedDeviceTargetUsers";
import "./DeviceLoginModal.styl";


export const DeviceLoginModal: React.FC = () => {
    const [searchValue, setSearchValue] = React.useState("");
    const hasOpenModal = useHasOpenModal();
    const currentUserId = useCurrentUserId();

    const { data: users } = useDeviceTargetUsers();
    const sortedDeviceTargetUsers = useSortedDeviceTargetUsers(users);
    const filteredDeviceUsers = React.useMemo(() => {
        const normalSearchValue = searchValue.toLowerCase().trim();
        return sortedDeviceTargetUsers
            .filter(deviceTargetUser => deviceTargetUser.id !== currentUserId)
            .filter((deviceTargetUser) => userMatchesSearchValue(deviceTargetUser, normalSearchValue));
    }, [sortedDeviceTargetUsers, searchValue, currentUserId]);

    if (!sortedDeviceTargetUsers?.length) return null;
    return (
        <ModalLayout>
            {!hasOpenModal && (
                <div className="deviceLoginModal">
                    <div className="deviceLoginModal-header">
                        <SearchInput
                            className="deviceLoginModal-search"
                            placeholder="Search for a user"
                            value={searchValue}
                            onChange={v => setSearchValue(v)}
                        />
                    </div>
                    <TargetList targetUsers={filteredDeviceUsers} />
                </div>
            )}
        </ModalLayout>
    );
}

function userMatchesSearchValue(user: User, searchValue: string): boolean {
    return user.displayName.toLowerCase().includes(searchValue) ||
        user.login.toLowerCase().includes(searchValue) ||
        user.firstName.toLowerCase().includes(searchValue) ||
        user.lastName.toLowerCase().includes(searchValue)
}
