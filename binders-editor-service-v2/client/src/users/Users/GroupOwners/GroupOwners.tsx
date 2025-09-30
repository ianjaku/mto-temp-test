import * as React from "react";
import GroupOwnerTile from "./GroupOwnerTile";
import Loader from "@binders/ui-kit/lib/elements/loader";
import SearchInput from "@binders/ui-kit/lib/elements/input/SearchInput";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useGroupOwnersContext } from "./GroupOwnersContext";
import { useMemo } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./GroupOwners.styl";


const GroupOwners: React.FC = () => {

    const { t } = useTranslation();

    const [groupNameMatch, setGroupNameMatch] = React.useState("");
    const changeGroupNameMatch = (value: string) => {
        setGroupNameMatch(value);
    };
    const { groups, isLoading } = useGroupOwnersContext();
    const visibleGroups = useMemo(() => groups?.filter(g =>
        g.name.toLowerCase().includes(groupNameMatch.toLowerCase())
    ), [groups, groupNameMatch]);

    if (isLoading) {
        return <Loader />
    }
    return (
        <div className="groupOwners">
            <div className="groupOwners-header">
                <SearchInput
                    onChange={changeGroupNameMatch}
                    placeholder={`${t(TK.User_GroupSearch)}...`}
                    value={groupNameMatch}
                />
            </div>
            <div className="groupOwners-tiles">
                {visibleGroups.map(group => (
                    <GroupOwnerTile key={group.id} group={group} />
                ))
                }
            </div>
        </div>
    )
}

export default GroupOwners;
