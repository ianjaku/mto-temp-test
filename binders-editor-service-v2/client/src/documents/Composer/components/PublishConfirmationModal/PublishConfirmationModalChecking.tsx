import React, { useEffect, useMemo } from "react";
import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { NotificationKind } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import cx from "classnames";
import { useNotificationTargets } from "../../../../notification/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import { useUsersAndGroups } from "../../../../users/query";

export const PublishConfirmationModalChecking: React.FC<{
    onDataLoaded: (usersAndGroups: (User | Usergroup)[]) => void,
    binderId: string,
}> = ({ onDataLoaded, binderId }) => {
    const { t } = useTranslation();

    const { data: targets, status: notificationTargetsStatus } = useNotificationTargets(binderId);
    const publishTargets = useMemo(() => {
        if (targets == null) return [];
        return targets.filter(t => t.notificationKind === NotificationKind.PUBLISH);
    }, [targets]);
    const userAndGroupIds = useMemo(() => {
        if (publishTargets.length === 0) return null;
        return publishTargets.map(pt => pt.targetId);
    }, [publishTargets]);
    const { data: usersAndGroups, status: userAndGroupsStatus } = useUsersAndGroups(userAndGroupIds);

    useEffect(() => {
        if (userAndGroupIds == null) {
            onDataLoaded([]);
            return;
        }
        if (notificationTargetsStatus === "success") {
            if (!targets || targets.length === 0) {
                onDataLoaded([]);
                return;
            }
            if (userAndGroupsStatus === "success") {
                onDataLoaded(usersAndGroups);
                return;
            }
        }
        if (notificationTargetsStatus === "error" || userAndGroupsStatus === "error") {
            onDataLoaded([]);
            return;
        }
    }, [notificationTargetsStatus, onDataLoaded, targets, userAndGroupsStatus, userAndGroupIds, usersAndGroups]);

    return (
        <div className={cx("publish-confirmation", "publish-confirmation-checking")}>
            {circularProgress(null, null, 22)}
            {t(TK.Edit_PubConfirm_Checking)}...
        </div>
    );
}
