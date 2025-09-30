import * as React from "react";
import {
    ApprovedStatus,
    IChunkApproval
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ChunkLoadingState, useChunkState } from "../../../../contexts/chunkStateContext";
import {
    EditorEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import { FC, useMemo } from "react";
import { onSaveChecklistActivation, updateChunkApproval } from "../../../../../actions";
import {
    AiOptimizeContentChunkMenuButtons
} from "../../../../../../content/AiOptimizeContentChunkMenuButtons";
import Check from "@binders/ui-kit/lib/elements/icons/Check";
import { ChunkOperation } from "../../ChunkControls/contract";
import Close from "@binders/ui-kit/lib/elements/icons/Close";
import ContextMenu from "@binders/ui-kit/lib/elements/contextmenu";
import Help from "@binders/ui-kit/lib/elements/icons/Help";
import { IChunkProps } from "./types";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import Separator from "@binders/ui-kit/lib/elements/contextmenu/Separator";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { ThreeDotsElastic } from "@binders/ui-kit/lib/elements/contextmenu/ThreeDotsElastic";
import Toggle from "@binders/ui-kit/lib/elements/icons/Toggle";
import colors from "@binders/ui-kit/lib/variables";
import cx from "classnames";
import { getBinderLogEntry } from "../../../../helpers/approvalHelper";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useRef, useEffect, useState, useCallback } = React;

type IChunkContextMenuProps = IChunkProps & {
    approval: IChunkApproval;
    chunkPosition: number;
    featuresAiContentFormatting: boolean;
    featuresApprovalFlow: boolean;
    hasReviewPermission: boolean;
    isChecklistActive: boolean;
}

function sendApproval(binder, chunkPosition, languageCode, approval: ApprovedStatus) {
    return () => {
        const logEntry = getBinderLogEntry(binder, chunkPosition);
        const isTitle = chunkPosition === -1;
        updateChunkApproval(
            binder.id,
            isTitle ? binder.id : logEntry.uuid,
            languageCode,
            isTitle ? Date.now() : logEntry.updatedAt,
            approval,
        );

        let eventName: EditorEvent;
        if (approval === ApprovedStatus.APPROVED) eventName = EditorEvent.ApprovalChunkApproved;
        if (approval === ApprovedStatus.REJECTED) eventName = EditorEvent.ApprovalChunkRejected;
        if (approval === ApprovedStatus.UNKNOWN) eventName = EditorEvent.ApprovalChunkCleared;
        if (!approval) return;
        captureFrontendEvent(eventName, {
            binderId: binder.id,
            chunkPosition,
            languageCode
        });
    }
}

const ChunkContextMenu: FC<IChunkContextMenuProps> = (props: IChunkContextMenuProps) => {
    const {
        approval,
        binder,
        chunkId,
        chunkPosition,
        featuresAiContentFormatting,
        featuresApprovalFlow,
        hasReviewPermission,
        includeChecklist,
        isChecklistActive,
        isEmpty,
        languageCode,
        onChunkOperation,
    } = props;

    const ref = useRef(null);
    const { t }: { t: TFunction } = useTranslation();
    const [isMenuVisible, setIsMenuVisible] = useState(false);

    useEffect(() => {
        setIsMenuVisible(false);
    }, [approval]);

    const hasValidApproval = (approval) => !!approval && approval.approved !== ApprovedStatus.UNKNOWN;
    const approvalChecked = (approval, value) => {
        if (!approval) {
            return value === ApprovedStatus.UNKNOWN ? "approval-checked" : "approval-unchecked";
        }
        return approval.approved === value ? "approval-checked" : "approval-unchecked";
    }

    const { chunkState } = useChunkState(chunkPosition + 1);
    const isContextMenuAnimating = chunkState.loadingState === ChunkLoadingState.Loading;
    const isContextMenuDisabled = chunkState.isReadOnly;

    const handleSaveChecklistActivation = useCallback(() => {
        onSaveChecklistActivation(binder["id"], chunkId, !isChecklistActive);
        onChunkOperation(chunkPosition, ChunkOperation.checklistItem);
    }, [binder, chunkId, chunkPosition, isChecklistActive, onChunkOperation]);

    const maybeRenderChecklistItems = useCallback(() => includeChecklist && (
        [
            <MenuItem
                key="checklistToggle"
                onClick={handleSaveChecklistActivation}
                title={t(TK.Edit_ChunkCheckable)}
                icon={<div className="">{Toggle(isChecklistActive, { fontSize: "3em", marginTop: 7 }, isChecklistActive && colors.accentColor)}</div>}
                persistent={true}
                noHoverAction={true}
            />
        ]
    ), [includeChecklist, t, isChecklistActive, handleSaveChecklistActivation]);

    const shouldRenderApprovalItems = useMemo(
        () => featuresApprovalFlow && hasReviewPermission,
        [featuresApprovalFlow, hasReviewPermission]
    );

    const maybeRenderApprovalItems = useCallback(() => {
        if (!shouldRenderApprovalItems) return undefined;
        if (isEmpty) {
            return [
                <MenuItem
                    key="approveEmptyChunk"
                    title={t(TK.Edit_ChunkEmpty)}
                    disabled={true}
                />
            ]
        }
        return [
            <MenuItem
                className="approveActionApprove"
                key="approveActionApprove"
                onClick={sendApproval(binder, chunkPosition, languageCode, ApprovedStatus.APPROVED)}
                title={t(TK.Edit_ChunkApprove)}
                icon={<div className={approvalChecked(approval, ApprovedStatus.APPROVED)}><Check /></div>}
            />,
            <MenuItem
                className="approveActionReject"
                key="approveActionReject"
                onClick={sendApproval(binder, chunkPosition, languageCode, ApprovedStatus.REJECTED)}
                title={t(TK.Edit_ChunkReject)}
                icon={<div className={approvalChecked(approval, ApprovedStatus.REJECTED)}><Close /></div>}
            />,
            hasValidApproval(approval) ?
                (
                    <MenuItem
                        className="approveActionClear"
                        key="approveActionClear"
                        onClick={sendApproval(binder, chunkPosition, languageCode, ApprovedStatus.UNKNOWN)}
                        title={t(TK.Edit_ChunkClear)}
                        icon={<div className={approvalChecked(approval, ApprovedStatus.UNKNOWN)}><Help /></div>}
                    />
                ) :
                null,
        ]
    }, [approval, binder, chunkPosition, languageCode, t, isEmpty, shouldRenderApprovalItems]);

    const maybeRenderFirstSeparator = useCallback(() => includeChecklist && shouldRenderApprovalItems && !isEmpty && (
        <Separator dotted={true} />
    ), [includeChecklist, isEmpty, shouldRenderApprovalItems]);

    const isAiContentOptimizationLDEnabled = useLaunchDarklyFlagValue<boolean>(LDFlags.AI_CONTENT_OPTIMIZATION);
    const hasAiContentFormattingButtons = isAiContentOptimizationLDEnabled && featuresAiContentFormatting && chunkPosition >= 0;

    const maybeRenderSecondSeparator = useCallback(() => (includeChecklist || shouldRenderApprovalItems) && !isEmpty && hasAiContentFormattingButtons && (
        <Separator dotted={true} />
    ), [hasAiContentFormattingButtons, includeChecklist, isEmpty, shouldRenderApprovalItems]);

    const maybeRenderAiContentFormatting = useCallback(() => hasAiContentFormattingButtons && (
        <AiOptimizeContentChunkMenuButtons
            binderObj={binder}
            chunkIdx={chunkPosition + 1}
            langIdx={binder.getLanguageIndex(languageCode)}
            toggleMenu={setIsMenuVisible}
        />
    ), [binder, chunkPosition, hasAiContentFormattingButtons, languageCode])

    const toggleMenu = useCallback(() => {
        if (!isMenuVisible && isContextMenuDisabled) return;
        setIsMenuVisible(!isMenuVisible);
    }, [isContextMenuDisabled, isMenuVisible, setIsMenuVisible])

    return (
        <div className="chunk-contextmenu" ref={ref}>
            <ContextMenu
                anchorRef={ref.current}
                onClose={() => setIsMenuVisible(false)}
                defaultOpened={true}
                open={isMenuVisible}
            >
                {maybeRenderChecklistItems()}
                {maybeRenderFirstSeparator()}
                {maybeRenderApprovalItems()}
                {maybeRenderSecondSeparator()}
                {maybeRenderAiContentFormatting()}
            </ContextMenu>
            <label
                className={cx(
                    "contextmenu-trigger",
                    isContextMenuDisabled && "contextmenu-trigger--disabled",
                )}
                onClick={toggleMenu}
            >
                <ThreeDotsElastic accent={isContextMenuAnimating} animated={isContextMenuAnimating} />
            </label>
        </div>
    )
}

export default ChunkContextMenu;
