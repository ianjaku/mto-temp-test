import * as React from "react";
import { FC, useCallback, useRef, useState } from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { getUserName, isUsergroup } from "@binders/client/lib/clients/userservice/v1/helpers";
import { APIMultiGetUsersAndGroups } from "../../../../../users/api";
import { APIRequestReview } from "../../../../api";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import Button from "@binders/ui-kit/lib/elements/button";
import { FlashMessages } from "../../../../../logging/FlashMessages";
import { NotificationKind } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { logClientError } from "@binders/client/lib/util/clientErrors";
import { useActiveAccountId } from "../../../../../accounts/hooks";
import { useNotificationTargets } from "../../../../../notification/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

enum SendState {
    NotSent,
    Sending,
    Sent
}

export const ReviewRequestButton: FC<{
    binderId: string;
    hasDraft: boolean;
}> = ({ binderId, hasDraft }) => {
    const { t } = useTranslation();
    const noDraftTooltipRef = useRef(null);
    const sentTooltipRef = useRef(null);
    const accountId = useActiveAccountId();
    const [sendState, setSendState] = useState(SendState.NotSent);
    const { data: notificationTargets } = useNotificationTargets(binderId);
    const reviewTargets = React.useMemo(
        () => notificationTargets?.filter(t => t.notificationKind === NotificationKind.REVIEW_REQUEST) ?? [],
        [notificationTargets]
    );

    const isEnabled = sendState === SendState.NotSent && hasDraft;

    const onMouseEnterReviewButton = useCallback((e) => {
        if (sendState === SendState.Sent) {
            return showTooltip(e, sentTooltipRef.current, TooltipPosition.BOTTOM);
        }
        if (!hasDraft) {
            return showTooltip(e, noDraftTooltipRef.current, TooltipPosition.BOTTOM);
        }
    }, [hasDraft, sendState]);

    const onMouseLeaveReviewButton = useCallback((e) => {
        hideTooltip(e, noDraftTooltipRef.current);
        hideTooltip(e, sentTooltipRef.current);
    }, []);

    const sendReviewRequest = async () => {
        try {
            setSendState(SendState.Sending);
            await APIRequestReview(accountId, binderId);
            setSendState(SendState.Sent);

            const ids = reviewTargets.map(t => t.targetId);
            const usersAndGroups = await APIMultiGetUsersAndGroups(accountId, ids);
            const labels = usersAndGroups.map(
                ug => isUsergroup(ug) ? ug.name : getUserName(ug)
            );
            FlashMessages.success(
                t(TK.Edit_ReviewRequestedFlash,
                    { targets: labels.join(", ") }
                )
            );
        }
        catch (e) {
            setSendState(SendState.NotSent);
            logClientError(Application.EDITOR, e, "Failed to send review request");
            FlashMessages.error(t(TK.Edit_RequestReviewFailed));
        }
    }
    
    return (
        <>
            <div
                onMouseEnter={onMouseEnterReviewButton}
                onMouseLeave={onMouseLeaveReviewButton}
            >
                <Button
                    id="reviewbtn"
                    isEnabled={isEnabled}
                    text={t(
                        sendState === SendState.Sent ?
                            TK.Edit_ReviewRequested :
                            TK.Edit_RequestReview
                    )}
                    CTA={true}
                    onClick={sendReviewRequest}
                />
            </div>
            <Tooltip
                key="empty-chunk-tt"
                ref={noDraftTooltipRef}
                message={t(TK.Edit_NothingChanged)}
            />
            <Tooltip
                key="already-sent-request"
                ref={sentTooltipRef}
                message={t(TK.Edit_AlreadySentReview)}
            />
        </>
    )
}
