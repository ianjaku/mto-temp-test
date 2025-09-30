import {
    IPermissionFlag,
    PermissionName
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { NotificationKind } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { permissionsForLanguageCode } from "../../../../../authorization/tsHelpers";
import { useMemo } from "react";
import { useNotificationTargets } from "../../../../../notification/hooks";

export enum ControlButtonsMode {
    Publish = "publish",
    Approve = "approve",
    Review = "review",
    PublishRequest = "publish-request",
}

export function useControlButtonsMode(
    binderId: string,
    featuresApproval: boolean,
    featuresNotifications: boolean,
    allChunksApproved: boolean,
    languageIsEmpty: boolean,
    languageCode: string,
    permissionFlags: IPermissionFlag[]
): ControlButtonsMode {
    const permissions = useMemo(
        () => new Set(permissionsForLanguageCode(permissionFlags, languageCode) ?? []),
        [permissionFlags, languageCode]
    );

    const { data: targets } = useNotificationTargets(binderId)
    const hasReviewRequestTargets = useMemo(() => {
        if (targets == null) return false;
        return targets.some(t => t.notificationKind === NotificationKind.REVIEW_REQUEST);
    }, [targets]);
    const hasPublishRequestTargets = useMemo(() => {
        if (targets == null) return false;
        return targets.some(t => t.notificationKind === NotificationKind.PUBLISH_REQUEST);
    }, [targets]);

    if (
        hasReviewRequestTargets &&
        !permissions.has(PermissionName.PUBLISH) &&
        permissions.has(PermissionName.EDIT) &&
        (
            // When ther are no publish requests, and the user is a reviewer, we still show the
            // request to publish button, so we don't break previous behaviour
            !permissions.has(PermissionName.REVIEW) ||
            !hasPublishRequestTargets
        )
    ) {
        return ControlButtonsMode.Review;
    }

    if (
        !languageIsEmpty &&
        featuresApproval &&
        permissions.has(PermissionName.REVIEW) &&
        !allChunksApproved
    ) {
        return ControlButtonsMode.Approve;
    }

    if (
        !languageIsEmpty &&
        featuresApproval &&
        featuresNotifications &&
        permissions.has(PermissionName.REVIEW) &&
        !permissions.has(PermissionName.PUBLISH)
    ) {
        return ControlButtonsMode.PublishRequest;
    }

    return ControlButtonsMode.Publish;
}