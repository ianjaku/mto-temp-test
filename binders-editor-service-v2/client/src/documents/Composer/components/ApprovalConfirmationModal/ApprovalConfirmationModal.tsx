import * as React from "react";
import {
    ApprovedStatus,
    ChunkApprovalFilter
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Button from "@binders/ui-kit/lib/elements/button";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { updateChunkApprovals } from "../../../actions";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ApprovalConfirmationModal.styl"

export interface IApprovalConfirmationModalProps {
    binderId: string;
    chunkCount: number;
    languageCode: string;
    unapprovedChunksCount: number;
}

async function approveAll(binderId: string, chunkCount: number, languageCode: string) {
    await updateChunkApprovals(
        binderId,
        {
            chunkIndices: [-1, ...Array.from(Array(chunkCount).keys())],
            chunkLanguageCodes: [languageCode],
        } as ChunkApprovalFilter,
        ApprovedStatus.APPROVED,
    );
}

export const ApprovalConfirmationModal: React.FC<ModalProps<IApprovalConfirmationModalProps, undefined>> =
    ({ params, hide }) => {
        const {
            binderId,
            chunkCount,
            languageCode,
            unapprovedChunksCount,
        } = params;

        const { t } = useTranslation();

        const doApprove = React.useCallback(async () => {
            hide();
            await approveAll(binderId, chunkCount, languageCode);
        }, [binderId, languageCode, hide, chunkCount]);

        const modalButtons = [
            <Button text={t(TK.General_Cancel)} secondary={true} onClick={hide} />,
            <Button text={t(TK.General_Yes)} onClick={doApprove} />,
        ];

        const confirmationMarkup = (
            <div>
                <p>
                    <strong>{t(TK.Edit_ChunkApproveAllConfirm, { count: unapprovedChunksCount })}</strong>
                </p>
                <p>
                    {t(TK.General_ConfirmProceed)}
                </p>
            </div>
        );

        return (
            <Modal
                title={t(TK.Edit_ChunkApproveAll)}
                buttons={modalButtons}
                onHide={hide}
                classNames="approval-modal"
                onEnterKey={doApprove}
                onEscapeKey={hide}
            >
                {confirmationMarkup}
            </Modal>
        );
    }

export default ApprovalConfirmationModal;
