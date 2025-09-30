import * as React from "react";
import { ControlButtonsMode, useControlButtonsMode } from "./useControlButtonsMode";
import {
    FEATURE_APPROVAL_FLOW,
    FEATURE_NOTIFICATIONS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    IPermissionFlag,
    PermissionName
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import AccountStore from "../../../../../accounts/store";
import BinderStore from "../../../../../documents/store";
import Close from "@binders/ui-kit/lib/elements/icons/Close";
import { IDocumentInfo } from "../types";
import InfoOutline from "@binders/ui-kit/lib/elements/icons/InfoOutline";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { flagsContainPermissions } from "../../../../../authorization/tsHelpers";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useMemo } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";

export interface ControlButtonsBehaviour {
    approveAllButtonVisible: boolean;
    approveAllButtonDisabled: boolean;
    publishButtonVisible: boolean;
    publishButtonDisabled: boolean;
    publishButtonCaption: string;
    reviewButtonVisible: boolean;
    previewButtonDisabled: boolean;
    showReasonLabel: boolean;
    reason?: string;
    reasonLabelStyle?: string;
    reasonLabelIcon?: React.ReactElement;
    viewButtonCaption: string;
    publishRequestButtonVisible: boolean;
}

const iconClose = <Close />;
const iconInfo = <InfoOutline />

function useControlButtonsBehaviour(
    languageCode: string,
    isDisabledView: boolean,
    isReadonlyMode: boolean,
    documentInfo: IDocumentInfo,
    hasDraft: boolean,
    allChunksApproved: boolean,
    hasPublications: boolean,
    binderId: string,
    permissionFlags: IPermissionFlag[],
): ControlButtonsBehaviour {
    const { t } = useTranslation();
    const accountFeatures: WebData<string[]> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getAccountFeatures());
    const featuresApproval = accountFeatures.state === WebDataState.SUCCESS && accountFeatures.data.includes(FEATURE_APPROVAL_FLOW);
    const featuresNotifications = accountFeatures.state === WebDataState.SUCCESS && accountFeatures.data.includes(FEATURE_NOTIFICATIONS);
    const publishInProgress: string[] = useFluxStoreAsAny(BinderStore, (_prevState, store) => store.getIsPublishInProgress());
    const isPublishDisabled = isDisabledView || isReadonlyMode;
    const languageIsEmpty = documentInfo.moduleSets.every(moduleSet => moduleSet.isEmpty) && documentInfo.titleModuleSet.isEmpty;
    const languageHasEmptyChunks = documentInfo.moduleSets.some(moduleSet => moduleSet.isEmpty) || documentInfo.titleModuleSet.isEmpty;

    const hasPublishPermission = useMemo(
        () => flagsContainPermissions(permissionFlags, [PermissionName.PUBLISH], { languageCode }),
        [languageCode, permissionFlags]
    );

    const mode = useControlButtonsMode(
        binderId,
        featuresApproval,
        featuresNotifications,
        allChunksApproved,
        languageIsEmpty,
        languageCode,
        permissionFlags
    );

    const defaultBehaviour: ControlButtonsBehaviour = useMemo(() => ({
        approveAllButtonVisible: mode === ControlButtonsMode.Approve,
        publishButtonVisible: mode === ControlButtonsMode.Publish,
        reviewButtonVisible: mode === ControlButtonsMode.Review,
        publishRequestButtonVisible: mode === ControlButtonsMode.PublishRequest,
        publishButtonCaption: !hasPublications || hasDraft ? t(TK.Edit_Publish) : t(TK.Edit_UpToDate),
        previewButtonDisabled: isDisabledView || !(hasDraft || hasPublications),
        viewButtonCaption: hasDraft ? t(TK.Edit_Preview) : t(TK.Edit_View),
        approveAllButtonDisabled: undefined,
        publishButtonDisabled: false,
        showReasonLabel: false,
        reason: null,
        reasonLabelIcon: iconClose,
        reasonLabelStyle: "default",
    }), [hasDraft, hasPublications, isDisabledView, mode, t]);

    const publishInProgressForSelectedLangCode = publishInProgress.includes(languageCode);

    if (isPublishDisabled) {
        return {
            ...defaultBehaviour,
            publishButtonDisabled: true,
            showReasonLabel: true,
            reason: TK.Edit_PublishDisabled,
            reasonLabelStyle: "default"
        };
    }

    if (mode === ControlButtonsMode.Review) {
        return defaultBehaviour;
    }

    if (mode === ControlButtonsMode.PublishRequest && hasDraft) {
        return defaultBehaviour;
    }

    if (mode === ControlButtonsMode.Approve) {
        if (languageHasEmptyChunks || documentInfo.isTitleTextEmpty) {
            return {
                ...defaultBehaviour,
                approveAllButtonDisabled: true,
                showReasonLabel: true,
                reasonLabelIcon: iconInfo,
                reasonLabelStyle: "info",
                reason: TK.Edit_ChunkApproveAllEmptyDetected,
            };
        }
        if (!allChunksApproved && hasPublishPermission) {
            return {
                ...defaultBehaviour,
                showReasonLabel: true,
                reason: TK.Edit_PublishFailNoApprovals,
                reasonLabelIcon: iconInfo,
                reasonLabelStyle: "info"
            };
        }
        return defaultBehaviour;
    }

    // else: mode === ControlButtonsMode.Publish
    if (!hasPublishPermission) {
        return {
            ...defaultBehaviour,
            publishButtonDisabled: true,
            showReasonLabel: true,
            reason: TK.Edit_PublishFailNoPermission,
            reasonLabelStyle: "default"
        };
    }

    if (documentInfo.isTitleTextEmpty) {
        return {
            ...defaultBehaviour,
            approveAllButtonDisabled: true,
            publishButtonDisabled: true,
            showReasonLabel: !languageIsEmpty,
            reason: TK.Edit_PublishFailNoTitle,
            reasonLabelStyle: "default"
        };
    }

    if (featuresApproval && languageHasEmptyChunks) {
        return {
            ...defaultBehaviour,
            approveAllButtonDisabled: true,
            publishButtonDisabled: true,
            showReasonLabel: true,
            reason: TK.Edit_PubEmptyChunk,
            reasonLabelStyle: "default"
        };
    }
    if (!hasDraft && hasPublications) {
        return {
            ...defaultBehaviour,
            publishButtonDisabled: true,
            showReasonLabel: true,
            reason: TK.Edit_UpToDate,
            reasonLabelIcon: iconInfo,
            reasonLabelStyle: "info"
        };
    }
    if (publishInProgressForSelectedLangCode) {
        return {
            ...defaultBehaviour,
            publishButtonDisabled: true,
            showReasonLabel: true,
            reason: TK.Edit_Publishing,
            reasonLabelIcon: iconInfo,
            reasonLabelStyle: "info"
        };
    }
    return defaultBehaviour;
}
export default useControlButtonsBehaviour;
