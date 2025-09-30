import * as React from "react";
import UserLinkerListCards from "./UserLinkerListCards";
import UserLinkerListHeader from "./UserLinkerListHeader";
import UserLinkerListRows from "./UserLinkerListRows";
import UserLinkerListTitle from "./UserLinkerListTitle";
import { useUserLinkerContext } from "./userLinkerContext";

export type UserCardSortMethod = "lastonline" | "name";

const UserLinkerList: React.FC = () => {
    const {
        hideFieldLabels,
        linkedUserIds,
        linkedUsergroupIntersections,
        renderAsCards,
        searchable,
        sortable,
    } = useUserLinkerContext();
    const [searchTerm, setSearchTerm] = React.useState("");
    const [sortMethod, setSortMethod] = React.useState<UserCardSortMethod>("lastonline");
    return (
        <div className="userLinker-section">
            {!hideFieldLabels && (
                <UserLinkerListTitle
                    linkedUsersCount={linkedUserIds.length + linkedUsergroupIntersections.length}
                />
            )}
            {(searchable || sortable) && (
                <UserLinkerListHeader
                    onUpdateSearchTerm={setSearchTerm}
                    searchTerm={searchTerm}
                    sortMethod={sortMethod}
                    onUpdateSortMethod={setSortMethod}
                    searchable={searchable}
                    sortable={sortable}
                />
            )}
            {renderAsCards ?
                (
                    <UserLinkerListCards
                        searchTerm={searchTerm}
                        sortMethod={sortMethod}
                    />
                ) :
                (
                    <UserLinkerListRows />
                )}
        </div>
    )
}

export default UserLinkerList;
