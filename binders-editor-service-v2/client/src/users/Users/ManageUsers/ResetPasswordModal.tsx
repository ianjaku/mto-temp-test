import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { FlashMessages } from "../../../logging/FlashMessages";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import RadioButtonGroup from "@binders/ui-kit/lib/elements/RadioButton/RadioButtonGroup";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import { validatePasswordInput } from "@binders/client/lib/clients/validation";

import "./ResetPasswordModal.styl";

export interface ResetPasswordModalProps {
    updateUserPassword: (newPassword: string) => Promise<void>;
    sendPasswordResetEmail: () => Promise<void>;
    onHide: () => void;
}

type ResetOption = "email" | "password";

export const ResetPasswordModal:  React.FC<ResetPasswordModalProps> = (props) => {
    const { t } = useTranslation();
    const [ resetOption, setResetOption ] = React.useState<ResetOption>("email");
    const [ isUpdating, setIsUpdating ] = React.useState(false);
    const [ newPassword, setNewPassword ] = React.useState("");

    const onClickPasswordInput = () => setResetOption("password");
    const onClickEmailInput = () => setResetOption("email");


    const sendPasswordResetEmail = async () => {
        setIsUpdating(true);
        try {
            await props.sendPasswordResetEmail();
        } catch (e) {
            FlashMessages.error(t(TK.User_ErrorWhenResetting, { error: e.message }));
        }
        setIsUpdating(false);
    }

    const ResetByMail = (
        <div>{t(TK.User_PasswordResetByEmail)}:</div>
    )
    const ResetByMailDetails = (
        <div className="reset-password-details">
            <div className="reset-by-mail">
                <Button
                    text={t(TK.User_SendPasswordReset)}
                    isEnabled={resetOption == "email" && !isUpdating}
                    onClick={sendPasswordResetEmail}
                />
            </div>
        </div>
    );

    const updateWithNewPassword = async () => {
        const passwordErrors = validatePasswordInput(newPassword);
        if (passwordErrors?.length > 0) {
            FlashMessages.error(passwordErrors.join("\n"));
            return;
        }
        setIsUpdating(true);
        try {
            await props.updateUserPassword(newPassword)
        } catch (e) {
            FlashMessages.error(t(TK.User_PasswordUpdateForUserFailure, { error: e.message }));
        }
        setIsUpdating(false);
    };

    const ResetByPassword = (
        <div>{t(TK.User_PasswordResetByProvidedPassword)}:</div>
    );
    const ResetByPasswordDetails = (
        <div className="reset-by-password reset-password-details">
            <div className="reset-password-by-password">
                <Input
                    type="password"
                    name="newPassword"
                    placeholder={t(TK.User_SetPassword)}
                    onClick={onClickPasswordInput}
                    value={newPassword}
                    onChange={setNewPassword}
                    hideFromAnalytics
                >
                </Input>
                <Button
                    text={t(TK.General_Save)}
                    style={{ flex: 1}}
                    isEnabled={resetOption == "password" && !isUpdating}
                    onClick={updateWithNewPassword}
                />
            </div>
        </div>
    );

    return (
        <Modal
            title={t(TK.User_ResetPasswordFormTitle)}
            onHide={props.onHide}
        >
            <div className={"password-reset-modal"}>
                <RadioButtonGroup
                    value={resetOption}
                >
                    <RadioButton
                        disabled={isUpdating}
                        value="email"
                        label={ResetByMail}
                        onChange={onClickEmailInput}
                        className="password-reset-modal-radio"
                    />
                    {ResetByMailDetails}
                    <RadioButton
                        disabled={isUpdating}
                        value="password"
                        label={ResetByPassword}
                        onChange={onClickPasswordInput}
                        className="password-reset-modal-radio"
                    />
                    {ResetByPasswordDetails}
                </RadioButtonGroup>
            </div>
        </Modal>
    );
}
