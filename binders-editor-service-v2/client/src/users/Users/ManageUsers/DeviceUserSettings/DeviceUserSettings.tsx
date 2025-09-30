import * as React from "react";
import { FC, useCallback, useMemo } from "react";
import { User, UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import { useAssignDeviceTargetUsers, useIsDeviceUserTarget, useParentDeviceUserIds } from "../../../query";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import DeviceUserTargets from "./DeviceUserTargets";
import Input from "@binders/ui-kit/lib/elements/input";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { getStoreUsersByIds } from "../../../tsActions";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { isManualToLogin } from "@binders/client/lib/util/user";
import { useActiveAccountId } from "../../../../accounts/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

const DeviceUserSettings: FC<{
    user: User;
    onChangeUserProp: (propName: keyof User, propValue: User[keyof User]) => unknown;
}> = ({ user, onChangeUserProp }) => {
    const { t } = useTranslation();
    const accountId = useActiveAccountId();

    const isDeviceUser = useMemo(() => {
        return `${user.type}` === `${UserType.Device}`;
    }, [user.type]);
    const isDeviceUserTarget = useIsDeviceUserTarget(user);
    const isTarget = isDeviceUserTarget || user.isPasswordless;
    const assignDeviceTargetUsers = useAssignDeviceTargetUsers();

    const onChangeIsDeviceUser = useCallback((v: boolean) => {
        onChangeUserProp("type", v ? `${UserType.Device}` : `${UserType.Individual}`);
        if (!v) {
            assignDeviceTargetUsers.mutate({
                accountId,
                deviceUserId: user.id,
                userAndGroupIds: [],
                usergroupIntersections: [],
            });
        }
    }, [accountId, assignDeviceTargetUsers, onChangeUserProp, user.id]);

    const isManualToUser = useMemo(() => isManualToLogin(user.login), [user.login]);

    const parentDeviceUserIds = useParentDeviceUserIds(user);
    const parentDeviceUsers = useMemo(() => getStoreUsersByIds(parentDeviceUserIds), [parentDeviceUserIds]);

    // There are cases when a device user can be linked to a group in which that device
    // user is a member of, we'd like to detect when that happens and still allow user target management
    const isDeviceUserTargetingItself = parentDeviceUserIds.includes(user.id);

    return (
        <div className="deviceUserSettings">
            {!isDeviceUserTargetingItself && isTarget && parentDeviceUsers?.length ?
                <div className="editModal-body-row editModal-body-row--vertical">
                    <label>
                        {t(TK.User_DeviceUserTargetInfo)}
                    </label>
                    <Input
                        type="text"
                        value={parentDeviceUsers.map(du => getUserName(du)).join(", ")}
                        disabled={true}
                    />
                </div> :
                <>
                    <div className="deviceUserSettings-section">
                        <Checkbox
                            onCheck={onChangeIsDeviceUser}
                            label={t(TK.User_DeviceUserCheck)}
                            checked={isDeviceUser}
                            disabled={isManualToUser}
                        />
                        {isManualToUser && (
                            <div className="deviceUserSettings-section-error">{t(TK.User_ManualtoUserCannotBeDevice)}</div>
                        )}
                    </div>
                    {isDeviceUser && (
                        <DeviceUserTargets
                            deviceUser={user}
                        />
                    )}
                </>
            }
        </div>
    )
}

export default DeviceUserSettings;
