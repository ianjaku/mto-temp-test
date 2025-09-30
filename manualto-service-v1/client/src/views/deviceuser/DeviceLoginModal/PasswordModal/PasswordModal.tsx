import * as React from "react";
import { Avatar } from "../Avatar/Avatar";
import Button from "@binders/ui-kit/lib/elements/button";
import Input from "@binders/ui-kit/lib/elements/input";
import { ModalComponent } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { ModalLayout } from "../ModalLayout/ModalLayout";
import { TK } from "@binders/client/lib/react/i18n/translations";
import infoOutline from "@binders/ui-kit/lib/elements/icons/InfoOutline";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./PasswordModal.styl";


export const PasswordModal: ModalComponent<{
    displayName: string;
    info?: string;
    submitButtonText: string;
    // Returns true if the provided password was valid and the modal can be shown, and otherwise false
    onSubmit: (password: string) => Promise<boolean>;
}> = ({ params, hide }) => {
    const { t } = useTranslation();
    const [password, setPassword] = React.useState("");
    const [passwordInvalid, setPasswordInvalid] = React.useState(false);

    const onAttemptLogin = async () => {
        setPasswordInvalid(false);
        const isValid = await params.onSubmit(password);
        setPasswordInvalid(!isValid);
        if (isValid) return hide();
    }
    
    return (
        <ModalLayout hideBg hideLogoutButton zIndexBump={1}>
            <div className="passwordModal">
                <div className="passwordModal-user">
                    <div className="passwordModal-user-avatar">
                        <Avatar displayName={params.displayName} size="40px" />
                    </div>
                    <div className="passwordModal-user-name">
                        {params.displayName}
                    </div>
                </div>
                <label htmlFor="password" className="passwordModal-label">
                    {t(TK.Login_EnterYourPassword)}
                </label>
                <div className="passwordModal-inputWrapper">
                    {passwordInvalid && (
                        <div className="passwordModal-error">
                            {t(TK.General_PasswordInvalid)}
                        </div>
                    )}
                    <Input 
                        className="passwordModal-input"
                        type="password"
                        name="password"
                        placeholder={t(TK.General_Password)}
                        onChange={value => setPassword(value)}
                        value={password}
                        autoFocus
                        isValid={!passwordInvalid}
                    />
                </div>
                {params.info && (
                    <div className="passwordModal-info">
                        {infoOutline({ fontSize: "16px" })}
                        {params.info}
                    </div>
                )}
                <div className="passwordModal-buttons">
                    <Button
                        text={t(TK.General_Back)}
                        secondary
                        onClick={() => hide()}
                        branded
                    />
                    <Button
                        text={params.submitButtonText}
                        isEnabled
                        onClick={onAttemptLogin}
                        branded
                        CTA
                    />
                </div>
            </div>
        </ModalLayout>
    );
}
