import * as React from "react";
import {
    Tooltip,
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { getUserName, isUsergroup } from "@binders/client/lib/clients/userservice/v1/helpers";
import {
    useNotificationTargets,
    useSendPublisRequestNotification
} from "../../../../../notification/hooks";
import { APIMultiGetUsersAndGroups } from "../../../../../users/api";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import Button from "@binders/ui-kit/lib/elements/button";
import { FC } from "react";
import { FlashMessages } from "../../../../../logging/FlashMessages";
import { NotificationKind } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { logClientError } from "@binders/client/lib/util/clientErrors";
import { useActiveAccountId } from "../../../../../accounts/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const PublishRequestButton: FC<{ binderId: string }> = (props) => {
    const { t } = useTranslation();
    const noTargetsTooltip = React.useRef(null);
    const sendRequest = useSendPublisRequestNotification();
    const accountId = useActiveAccountId();
    const { data: notificationTargets } = useNotificationTargets(props.binderId);
    const publishTargets = React.useMemo(
        () => notificationTargets?.filter(t => t.notificationKind === NotificationKind.PUBLISH_REQUEST) ?? [],
        [notificationTargets]
    );
    const isEnabled = publishTargets.length > 0 && (sendRequest.isIdle || sendRequest.isError);

    const onClick = async () => {
        try {
            await sendRequest.mutateAsync({ binderId: props.binderId });

            const ids = publishTargets.map(t => t.targetId);
            const usersAndGroups = await APIMultiGetUsersAndGroups(accountId, ids);
            const labels = usersAndGroups.map(
                ug => isUsergroup(ug) ? ug.name : getUserName(ug)
            );
            FlashMessages.success(
                t(TK.Edit_ReviewRequestedFlash,
                    { targets: labels.join(", ") }
                )
            );
        } catch (e) {
            logClientError(Application.EDITOR, e, "Failed to send publish request");
            FlashMessages.error(t(TK.Edit_RequestPublishFailed));
        }
    }

    const buttonText = () => {
        if (sendRequest.isLoading) return t(TK.General_Loading);
        if (sendRequest.isIdle || sendRequest.isError) return t(TK.Edit_RequestPublish);
        return t(TK.Edit_RequestPublishSent);
    }

    
    return (
        <>
            <div
                onMouseEnter={e => {
                    if (publishTargets.length === 0) {
                        showTooltip(e, noTargetsTooltip.current, TooltipPosition.BOTTOM)
                    }
                }}
                onMouseLeave={e => hideTooltip(e, noTargetsTooltip.current)}
            >
                <Button
                    id="requestToPublishButton"
                    text={buttonText()}
                    isEnabled={isEnabled}
                    CTA={true}
                    onClick={onClick}
                />
            </div>
            <Tooltip
                key="no-review-targets"
                ref={noTargetsTooltip}
                message={t(TK.Edit_RequestPublishNoTargets)}
            />
        </>
    )
}
