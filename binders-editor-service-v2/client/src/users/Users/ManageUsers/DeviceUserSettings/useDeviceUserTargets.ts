import { DeviceTargetUserLink, User, } from "@binders/client/lib/clients/userservice/v1/contract";
import { intersection, uniq } from "ramda";
import { useCallback, useMemo, useState } from "react";
import { CreateDTUserConfirmation } from "./CreateDTUserConfirmation";
import { FlashMessages } from "../../../../logging/FlashMessages";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UserInputType } from "../../../../shared/user-input/UserInputTypeSwitcher";
import { createDeviceTargetUsers } from "../../../tsActions";
import { showModal } from "@binders/ui-kit/lib/compounds/modals/showModal";
import { useAssignDeviceTargetUsers } from "../../../query";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export function useDeviceUserTargets({
    accountId, deviceTargetUserLinks, deviceUser,
}: {
    accountId: string;
    deviceTargetUserLinks: DeviceTargetUserLink[];
    deviceUser: User;
}) {
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useTranslation();

    const deviceTargetUserIds = useMemo(
        () => deviceTargetUserLinks.find(link => link.deviceUserId === deviceUser.id)?.userIds || [],
        [deviceTargetUserLinks, deviceUser]);
    const deviceTargetUsergroupIntersections = useMemo(
        () => deviceTargetUserLinks.find(link => link.deviceUserId === deviceUser.id)?.usergroupIntersections || [],
        [deviceTargetUserLinks, deviceUser]);
    const userIdsIgnoreList = useMemo<string[]>(() => {
        return [
            deviceUser.id,
            ...deviceTargetUserIds,
        ];
    }, [deviceTargetUserIds, deviceUser]);
    const usergroupIntersections = useMemo(
        () => deviceTargetUserLinks.find(link => link.deviceUserId === deviceUser.id)?.usergroupIntersections || [],
        [deviceTargetUserLinks, deviceUser]);

    const onCreateUsers = useCallback(async (names: string[]) => {
        const shouldProceed = await showModal(CreateDTUserConfirmation, { names });
        if (!shouldProceed) {
            return undefined;
        }
        try {
            setIsLoading(true);
            const users = await createDeviceTargetUsers(names, accountId, deviceUser.login);
            return users;
        } catch (error) {
            if (error.statusCode === 422) {
                FlashMessages.error(t(TK.User_Invalid, { login: deviceUser.login }));
            } else {
                FlashMessages.error(t(TK.General_SomethingWentWrong));
            }
        } finally {
            setIsLoading(false);
        }
    }, [accountId, deviceUser, t]);

    const assignDeviceTargetUsers = useAssignDeviceTargetUsers().mutateAsync;

    const onLinkUsers = useCallback(async (ids: string[]) => {
        const allIds = uniq([...deviceTargetUserIds, ...ids]);
        await assignDeviceTargetUsers({
            accountId,
            deviceUserId: deviceUser.id,
            userAndGroupIds: allIds,
            usergroupIntersections,
        });
    }, [accountId, assignDeviceTargetUsers, deviceTargetUserIds, deviceUser, usergroupIntersections]);

    const onUnlinkUser = useCallback(async (idToUnlink: string) => {
        const allIds = deviceTargetUserIds.filter(id => id !== idToUnlink);
        await assignDeviceTargetUsers({
            accountId,
            deviceUserId: deviceUser.id,
            userAndGroupIds: allIds,
            usergroupIntersections,
        });
    }, [accountId, assignDeviceTargetUsers, deviceTargetUserIds, deviceUser, usergroupIntersections]);

    const onLinkUsergroupIntersection = useCallback(async (groupIds: string[]) => {
        const allUsergroupIntersections = uniq([...usergroupIntersections, groupIds]);
        await assignDeviceTargetUsers({
            accountId,
            deviceUserId: deviceUser.id,
            userAndGroupIds: deviceTargetUserIds,
            usergroupIntersections: allUsergroupIntersections,
        });
    }, [accountId, assignDeviceTargetUsers, deviceTargetUserIds, deviceUser.id, usergroupIntersections]);

    const onUnlinkUsergroupIntersection = useCallback(async (groupIds: string[]) => {
        const allUsergroupIntersections = usergroupIntersections.filter(ids => intersection(ids, groupIds).length !== ids.length);
        await assignDeviceTargetUsers({
            accountId,
            deviceUserId: deviceUser.id,
            userAndGroupIds: deviceTargetUserIds,
            usergroupIntersections: allUsergroupIntersections,
        });
    }, [accountId, assignDeviceTargetUsers, deviceTargetUserIds, deviceUser.id, usergroupIntersections]);

    const isGroupIntersectionLDEnabled = useLaunchDarklyFlagValue<boolean>(LDFlags.DEVICE_USER_GROUP_INTERSECTION);
    const enabledUserTypes = useMemo(
        () => isGroupIntersectionLDEnabled ?
            [UserInputType.User, UserInputType.Group, UserInputType.GroupIntersection] :
            [UserInputType.User, UserInputType.Group],
        [isGroupIntersectionLDEnabled]
    );

    return {
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
    }
}
