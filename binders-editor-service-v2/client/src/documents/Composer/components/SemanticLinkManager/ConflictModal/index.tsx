import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./conflict-modal.styl";

const ConflictModal: React.FC<ModalProps<{
    /**/
}, boolean>> = ({ hide }) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={t(TK.DocManagement_SemLinkOverrideInTrashT)}
            buttons={[
                <Button text={t(TK.General_No)} secondary onClick={() => hide(false)} />,
                <Button text={t(TK.General_Yes)} CTA={true} onClick={() => hide(true)} />,
            ]}
            classNames="conflictModal"
        >
            <p>
                {t(TK.DocManagement_SemLinkOverrideInTrashQ)}
            </p>
        </Modal>
    )
}

export default ConflictModal;