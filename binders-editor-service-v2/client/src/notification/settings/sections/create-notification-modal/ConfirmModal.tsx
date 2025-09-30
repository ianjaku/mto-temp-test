import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { FC } from "react";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const ConfirmModal: FC<ModalProps<{
    title: string;
    message: string;
    zIndexBump?: number;
}, boolean>> = ({
    params,
    hide,
}) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={params.title}
            buttons={[
                <Button text={t(TK.General_No)} secondary onClick={() => hide(false)} />,
                <Button text={t(TK.General_Yes)} CTA={true} onClick={() => hide(true)} />,
            ]}
            zIndexBump={params.zIndexBump}
        >
            <p>{params.message}</p>
        </Modal>
    )
}
