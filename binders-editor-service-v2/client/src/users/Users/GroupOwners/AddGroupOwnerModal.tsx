import * as React from "react";
import { useCallback, useMemo } from "react";
import { GroupOwnerGroup } from "./contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UserLinker from "../../../shared/UserLinker/UserLinker";
import { uniq } from "ramda";
import { useGroupOwnersContext } from "./GroupOwnersContext";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";
import { useTranslation } from "@binders/client/lib/react/i18n";

interface Props {
    group: GroupOwnerGroup;
    onRequestClose: () => void;
}

const AddGroupOwnerModal: React.FC<Props> = ({ group, onRequestClose }) => {
    const { t } = useTranslation();
    const { onGroupOwnersChange } = useGroupOwnersContext();
    const ref = useOutsideClick<HTMLDivElement>(onRequestClose);

    const ownerUserIds = useMemo(
        () => group.ownerUserIds || [],
        [group]
    );

    const onSetOwners = useCallback(async (userIds: string[]) => {
        const ownerIds = uniq([...ownerUserIds, ...userIds]);
        await onGroupOwnersChange(group.id, ownerIds);
        onRequestClose();
    }, [group, onRequestClose, ownerUserIds, onGroupOwnersChange]);

    const onRemoveOwner = useCallback(async (userId: string) => {
        const ownerIds = ownerUserIds.filter(id => id !== userId);
        await onGroupOwnersChange(group.id, ownerIds);
    }, [group, ownerUserIds, onGroupOwnersChange]);

    return (
        <div className="addGroupOwnerModal" ref={ref}>
            {ownerUserIds.length ?
                (
                    <p className="addGroupOwnerModal-title">
                        {t(TK.User_GroupOwners_TabTitle)}
                    </p>
                ) :
                (
                    <p className="addGroupOwnerModal-info">
                        {t(TK.User_GroupOwners_AddInfo)}
                    </p>
                )}
            <UserLinker
                onLinkUsers={onSetOwners}
                onUnlinkUser={onRemoveOwner}
                linkedUserIds={ownerUserIds}
                hideFieldLabels
                messageOverrides={{
                    linkUsersPlaceholder: t(TK.User_GroupOwners_AddPlaceholder),
                    noUserMatches: t(TK.User_GroupOwners_NoMatches),
                }}
                allowUserCreation={false}
                needsEditorAccess={true}
                addBtnCaption={t(TK.General_Assign)}
                tighterLayout
                usernameLookupList={group.owners}
                hideAddWhenEmptyInput
                disallowGroups
            />
        </div>
    )
}

export default AddGroupOwnerModal;