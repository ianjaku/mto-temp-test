import * as React from "react";
import { DirtyStateId } from "../../../../shared/DirtyStateContext";
import { FC } from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import UserLinker from "../../../../shared/UserLinker/UserLinker";
import { isNotDefaultAccountGroupName } from "@binders/client/lib/util/group";
import { isNotManualToLogin } from "@binders/client/lib/util/user";
import { useActiveAccountId } from "../../../../accounts/hooks";
import { useDeviceTargetUserLinksOrEmpty } from "../../../hooks";
import { useDeviceUserTargets } from "./useDeviceUserTargets";
import { useTranslation } from "@binders/client/lib/react/i18n";

const DeviceUserTargets: FC<{ deviceUser: User }> = ({ deviceUser }) => {
    const deviceTargetUserLinks = useDeviceTargetUserLinksOrEmpty();

    const { t } = useTranslation();
    const accountId = useActiveAccountId();

    const {
        deviceTargetUsergroupIntersections,
        deviceTargetUserIds,
        enabledUserTypes,
        isLoading,
        onCreateUsers,
        onLinkUsers,
        onUnlinkUser,
        onLinkUsergroupIntersection,
        onUnlinkUsergroupIntersection,
        userIdsIgnoreList,
    } = useDeviceUserTargets({
        accountId,
        deviceUser,
        deviceTargetUserLinks,
    })

    return (
        <UserLinker
            allowUserCreation={true}
            dirtyStateId={DirtyStateId.deviceUserTargets}
            enabledUserTypes={enabledUserTypes}
            inlineAddBtn
            isLoading={isLoading}
            linkedUsergroupIntersections={deviceTargetUsergroupIntersections}
            linkedUserIds={deviceTargetUserIds}
            messageOverrides={{
                linkUsersPlaceholder: t(TK.User_DeviceUserTargetUsersPlaceholder),
                noUserMatches: `${t(TK.User_UserLinkerNoMatches)} ${t(TK.User_UserLinkerCreateAllowed)}`,
            }}
            onCreateUsers={onCreateUsers}
            onLinkUsers={onLinkUsers}
            onUnlinkUser={onUnlinkUser}
            onLinkUsergroupIntersection={onLinkUsergroupIntersection}
            onUnlinkUsergroupIntersection={onUnlinkUsergroupIntersection}
            renderAsCards
            searchable
            sortable
            userIdsIgnoreList={userIdsIgnoreList}
            linkedTargetsFilter={(loginOrGroupName: string) => isNotManualToLogin(loginOrGroupName) && isNotDefaultAccountGroupName(loginOrGroupName)}
        />
    )
}

export default DeviceUserTargets;
