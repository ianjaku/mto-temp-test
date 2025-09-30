import * as React from "react";
import { FC, useState } from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./CreateNotificationModal.styl";

export const CreateTemplateNotificationModal: FC<
    ModalProps<undefined, undefined | string>
> = ({ hide }) => {
    const { t } = useTranslation();
    const [name, setName] = useState("");

    return (
        <Modal title="Create template">
            <div className="create-email-not-modal">
                <div className="create-email-not-row">
                    <label htmlFor="subject" className="create-email-not-label">
                        {t(TK.Notifications_TemplateName)}
                    </label>
                    <Input
                        className="create-email-not-input"
                        id="subject"
                        value={name}
                        onChange={setName}
                        autoFocus
                        placeholder={t(TK.Notifications_TemplateName)}
                    />
                </div>
                <div className="create-email-not-buttons">
                    <Button
                        isEnabled={name.length > 0}
                        text={t(TK.Notifications_SaveTemplate)}
                        className="create-email-not-button"
                        onClick={() => hide(name)}
                    />
                </div>
            </div>
        </Modal>
    )
}
