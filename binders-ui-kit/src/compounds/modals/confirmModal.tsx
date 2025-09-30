import * as React from "react";
import Button from "../../elements/button";
import { FC } from "react";
import Modal from "../../elements/modal";
import { ModalProps } from "./ModalViewProvider";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ConfirmModal.styl";

export const ConfirmModal: FC<ModalProps<{
    title: string;
    message: string;
}, boolean>> = ({
    params,
    hide
}) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={params.title}
            buttons={[
                <Button text={t(TK.General_No)} secondary onClick={() => hide(false)} />,
                <Button text={t(TK.General_Yes)} CTA={true} onClick={() => hide(true)} />,
            ]}
        >
            <p>{params.message}</p>
        </Modal>
    )
}