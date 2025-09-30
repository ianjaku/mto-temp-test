import * as React from "react";
import { Avatar } from "../Avatar/Avatar";
import Button from "@binders/ui-kit/lib/elements/button";
import Input from "@binders/ui-kit/lib/elements/input";
import { ModalComponent } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { ModalLayout } from "../ModalLayout/ModalLayout";
import { TK } from "@binders/client/lib/react/i18n/translations";
import errorOutline from "@binders/ui-kit/lib/elements/icons/ErrorOutline";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./SetInitialPasswordModal.styl";

export enum SelectPasswordErrorCode {
    INVALID_PASSWORD = "INVALID_PASSWORD",
    NOT_AUTHORIZED = "NOT_AUTHORIZED",
}

const errorCodeToMessage = (errorCode: SelectPasswordErrorCode): string => {
    switch (errorCode) {
        case SelectPasswordErrorCode.NOT_AUTHORIZED:
            return TK.Ceva_UserNotAllowedToSelectPassword;
        case SelectPasswordErrorCode.INVALID_PASSWORD:
            return TK.General_PasswordInvalid;
        default:
            return TK.General_SomethingWentWrong;
    }
};

export const SetInitialPasswordModal: ModalComponent<{
    displayName: string;
    onSubmit: (password: string) => Promise<SelectPasswordErrorCode|null>;
}> = ({ params , hide }) => {
    const { t } = useTranslation();
    const [ password, setPassword ] = React.useState("");
    const [ repeatedPassword , setRepeatedPassword ] = React.useState("");
    const [ selectPasswordErrorCode, setSelectPasswordErrorCode ] = React.useState<SelectPasswordErrorCode>(null);

    const passwordsMismatch = !!password && password !== repeatedPassword;
    const modalInError = passwordsMismatch || selectPasswordErrorCode;

    const updatePassword = (passwordSetter: (p: string) => void) => (password: string) => {
        setSelectPasswordErrorCode(null);
        passwordSetter(password);
    }

    return <ModalLayout hideBg hideLogoutButton zIndexBump={1}>
        <div className="setInitialPasswordModal">
            <div className="setInitialPasswordModal-user">
                <div className="setInitialPasswordModal-user-avatar">
                    <Avatar displayName={params.displayName} size="40px" />
                </div>
                <div className="setInitialPasswordModal-user-name">
                    {params.displayName}
                </div>
            </div>
            <label htmlFor="password" className="setInitialPasswordModal-label">
                {t(TK.User_ChoosePassword)}
            </label>
            <div className="setInitialPasswordModal-input-wrapper">
                <Input
                    name="password"
                    type="text"
                    placeholder={`${t(TK.User_NewPassword)}`}
                    onChange={updatePassword(setPassword)}
                    autoComplete="off"
                    autoFocus
                    isValid={!modalInError}
                    hideFromAnalytics
                />
                <div className="setInitialPasswordModal-input-wrapper-info">
                    {t(TK.User_MinPasswordLengthError, { minPasswordLength: 6 })}
                </div>
                <Input
                    name="repeatedPassword"
                    type="text"
                    placeholder={`${t(TK.User_RepeatPassword)}`}
                    onChange={updatePassword(setRepeatedPassword)}
                    autoComplete="off"
                    isValid={!modalInError}
                    hideFromAnalytics
                />
                {modalInError && (
                    <div className="setInitialPasswordModal-input-wrapper-error">
                        {errorOutline({fontSize: "16px"})}
                        {t(passwordsMismatch ? TK.User_PasswordsNoMatch : errorCodeToMessage(selectPasswordErrorCode))}
                    </div>
                )}
            </div>
            <div className="setInitialPasswordModal-buttons">
                <Button
                    text={t(TK.General_Back)}
                    secondary
                    branded
                    onClick={() => hide()}
                />
                <Button
                    isEnabled={!passwordsMismatch}
                    text={t(TK.General_Save)}
                    branded
                    CTA
                    onClick={async () => {
                        const errorCode = await params.onSubmit(password);
                        if (!errorCode) {
                            hide();
                        } else {
                            setSelectPasswordErrorCode(errorCode);
                        }
                    }}
                />
            </div>
        </div>
    </ModalLayout>;
}