import Modal, { ModalWidth } from "@binders/ui-kit/lib/elements/modal";
import React, { useCallback } from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import type { ModalComponent } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CommentDeleteConfirmationModal.styl";

export const CommentDeleteConfirmationModal: ModalComponent<{
    onConfirm: () => void,
}> = ({ params: { onConfirm }, hide }) => {
    const { t } = useTranslation();

    const onConfirmClick = useCallback(() => {
        onConfirm();
        hide();
    }, [onConfirm, hide])

    return (
        // We're stopping the propagation of clicks because the Modal is
        // only listening to mousedown and useClickOutside gets triggered
        <div onClick={e => e.stopPropagation()}>
            <Modal
                title={t(TK.Comments_DeletionConfirmation_Title)}
                buttons={[
                    <Button
                        text={t(TK.General_Cancel)}
                        secondary
                        onClick={() => hide()}
                    />,
                    <Button
                        text={t(TK.Edit_CommentDelete)}
                        CTA
                        onClick={onConfirmClick}
                    />
                ]}
                classNames={"comment-delete-confirmation-modal"}
                withoutPadding
                mobileViewOptions={{
                    stretchX: {doStretch: true},
                    stretchY: {doStretch: true, allowShrink: true, minTopGap: 0, maxTopGap: 150},
                    flyFromBottom: true,
                }}
                modalWidth={ModalWidth.Medium1}
                onHide={hide}
            >
                <p className="comment-delete-confirmation-modal-message">
                    <span>{t(TK.Comments_DeletionWarning)}</span>
                    <span>{t(TK.General_ActionIsFinal)}</span>
                </p>
            </Modal>
        </div>
    );
};