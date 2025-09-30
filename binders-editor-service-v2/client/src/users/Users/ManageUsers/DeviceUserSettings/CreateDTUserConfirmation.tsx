import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { FC } from "react";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const CreateDTUserConfirmation: FC<ModalProps<{
    names,
}, boolean>> = ({ params, hide }) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={t(TK.User_DeviceAddNewUserConfirmation_title)}
            buttons={[
                <Button text={t(TK.General_No)} secondary onClick={() => hide(false)} />,
                <Button text={t(TK.General_Yes)} CTA={true} onClick={() => hide(true)} />,
            ]}
            zIndexBump={1}
        >
            <div>
                <p>
                    {t(TK.User_DeviceAddNewUserConfirmation, { count: params.names.length })}
                    {params.names.map(name => (
                        <span key={name}>
                            <br />
                            {name}
                        </span>
                    ))}
                </p>
                <br />
                <p>
                    {t(TK.General_ConfirmProceed)}
                </p>
            </div>
        </Modal>
    )
}