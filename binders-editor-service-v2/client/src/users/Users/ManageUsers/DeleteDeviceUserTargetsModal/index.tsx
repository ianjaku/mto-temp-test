import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { Markdown } from "@binders/ui-kit/lib/elements/Markdown";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { useTranslation } from "@binders/client/lib/react/i18n";

const DeleteDeviceUserTargetsModal: React.FC<ModalProps<
    { users: User[] }, boolean>> = ({ hide, params }) => {
        const { t } = useTranslation();

        return (
            <Modal
                title="Delete exclusive ones"
                onHide={hide}
                buttons={[
                    <Button text={t(TK.General_No)} secondary onClick={() => hide(false)} />,
                    <Button text={t(TK.General_Yes)} CTA={true} onClick={() => hide(true)} />,
                ]}
            >
                <Markdown element="label">
                    {t(TK.User_DeviceRemoveExclusiveTargetsMarkdown, {
                        userCsv: params.users.map(u => `- ${buildUserName(u)}`).join("\n")
                    })}
                </Markdown>
            </Modal>
        )
    }

export default DeleteDeviceUserTargetsModal
