import * as React from "react";
import Modal, { ModalWidth } from "@binders/ui-kit/lib/elements/modal";
import Button from "@binders/ui-kit/lib/elements/button";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ConfirmationDialogModal.styl";

export const ConfirmationDialogModal: React.FC<{
    discardChanges: () => void;
    keepEditing: () => void;
}> = ({ discardChanges, keepEditing }) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={t(TK.ReaderFeedback_Setting_DiscardChangesConfirmTitle)}
            buttons={[
                <Button
                    text={t(TK.General_DiscardChanges)}
                    secondary
                    onClick={discardChanges}
                />,
                <Button
                    text={t(TK.General_KeepEditing)}
                    onClick={keepEditing}
                />
            ]}
            classNames={"confirmation-dialog-modal"}
            onHide={() => false}
            closeIcon={null}
            noCloseIcon={true}
            withoutPadding={true}
            mobileViewOptions={{
                stretchX: { doStretch: true },
                stretchY: { doStretch: true, allowShrink: true, minTopGap: 0, maxTopGap: 150 },
                flyFromBottom: true,
            }}
            modalWidth={ModalWidth.Medium1}
        >
            <p className="confirmation-dialog-modal-message">
                {t(TK.General_DiscardChangesConfirmBody)}
            </p>
        </Modal>
    );
};