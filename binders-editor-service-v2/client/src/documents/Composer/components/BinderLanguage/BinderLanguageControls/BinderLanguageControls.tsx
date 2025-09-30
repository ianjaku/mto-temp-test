import * as React from "react";
import { FC, useCallback, useRef } from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import {
    useBinderLanguageComputedProps,
    useBinderLanguageProps
} from "../../../contexts/binderLanguagePropsContext";
import {
    useComposerComputedProps,
    useComposerProps
} from "../../../contexts/composerPropsContext";
import ApprovalConfirmationModal from "../../ApprovalConfirmationModal";
import Button from "@binders/ui-kit/lib/elements/button";
import { IDocumentInfo } from "../types";
import PublishConfirmationModal from "../../PublishConfirmationModal";
import { PublishRequestButton } from "../request/PublishRequestButton";
import { ReviewRequestButton } from "../request/ReviewRequestButton";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { showModal } from "@binders/ui-kit/lib/compounds/modals/showModal";
import useControlButtonsBehaviour from "./useControlButtonsBehaviour";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";

interface IBinderLanguageControlsProps {
    allChunksApproved: boolean;
    documentInfo?: IDocumentInfo;
    gridColumn: number;
    gridRow: number;
    isReadonlyMode?: boolean;
    languageCode: string;
    readerLocation: string;
    unapprovedChunksCount: number;
}

const BinderLanguageControls: FC<IBinderLanguageControlsProps> = ({
    allChunksApproved,
    documentInfo,
    gridColumn,
    gridRow,
    isReadonlyMode,
    languageCode,
    readerLocation,
    unapprovedChunksCount,
}) => {

    const controlButtonTooltip = useRef(null);

    const {
        isDisabledView,
        permissionFlags,
    } = useComposerProps();
    const { publicationLocations, openReaderWindow } = useComposerComputedProps();

    const {
        binder,
        hasDraft,
        hasPublications
    } = useBinderLanguageProps();

    const { chunkCount } = useBinderLanguageComputedProps();

    const { t }: { t: TFunction } = useTranslation();

    const styleObj = {
        gridRow,
        msGridRow: gridRow,
        gridColumn,
        msGridColumn: gridColumn,
    } as React.CSSProperties;

    const {
        approveAllButtonVisible,
        approveAllButtonDisabled,
        publishButtonVisible,
        publishButtonDisabled,
        publishButtonCaption,
        reviewButtonVisible,
        publishRequestButtonVisible,
        previewButtonDisabled,
        showReasonLabel,
        reason,
        reasonLabelStyle,
        reasonLabelIcon,
        viewButtonCaption,
    } = useControlButtonsBehaviour(
        languageCode,
        isDisabledView,
        isReadonlyMode,
        documentInfo,
        hasDraft,
        allChunksApproved,
        hasPublications,
        binder.id,
        permissionFlags,
    );

    const reasonMarkup = showReasonLabel ?
        (
            <>
                {reason && reasonLabelIcon}
                <span>{reason && t(reason)}</span>
            </>
        ) :
        (<></>);

    const showPublishConfirmationModal = useShowModal(PublishConfirmationModal);

    const showApprovalConfirm = useCallback(() => {
        showModal(
            ApprovalConfirmationModal,
            {
                binderId: binder.id,
                languageCode,
                chunkCount,
                unapprovedChunksCount,
            }
        );
    }, [binder, chunkCount, languageCode, unapprovedChunksCount]);

    const mouseEnterControlBtn = (e: React.MouseEvent<HTMLElement>) => {
        if (reason && !showReasonLabel) {
            showTooltip(e, controlButtonTooltip.current, TooltipPosition.TOP);
        }
    }
    const mouseLeaveControlBtn = e => hideTooltip(e, controlButtonTooltip.current);

    return (
        <div
            className="binderLanguageControls"
            style={styleObj}
        >
            <div className={`binderLanguageControls-status binderLanguageControls-${reasonLabelStyle}`}>
                {reasonMarkup}
            </div>
            <div className="binderLanguageControls-row">
                <Button
                    isEnabled={!previewButtonDisabled}
                    text={viewButtonCaption}
                    onClick={() => openReaderWindow(languageCode, hasDraft)}
                />
                {reviewButtonVisible && (
                    <ReviewRequestButton
                        binderId={binder.id}
                        hasDraft={hasDraft}
                    />
                )}
                {publishRequestButtonVisible && (
                    <PublishRequestButton binderId={binder.id} />
                )}
                {approveAllButtonVisible && (
                    <Button
                        id="approveAllButton"
                        text={t(TK.Edit_ChunkApproveAll)}
                        CTA={true}
                        onClick={showApprovalConfirm}
                        isEnabled={!approveAllButtonDisabled}
                        onMouseOver={mouseEnterControlBtn}
                        onMouseLeave={mouseLeaveControlBtn}
                        mouseOverActiveOnDisabled={true}
                    />
                )}
                {publishButtonVisible && (
                    <Button
                        id="publishbtn"
                        isEnabled={!publishButtonDisabled}
                        text={publishButtonCaption}
                        CTA={true}
                        onClick={() => showPublishConfirmationModal({
                            binder,
                            languageCode,
                            publicationLocations,
                            readerLocation,
                            onView: () => openReaderWindow(languageCode, false),
                        })}
                        onMouseOver={mouseEnterControlBtn}
                        onMouseLeave={mouseLeaveControlBtn}
                        mouseOverActiveOnDisabled={true}
                    />
                )}
                <Tooltip ref={controlButtonTooltip} message={t(reason)} />
            </div>
        </div>
    );
}

export default BinderLanguageControls;
