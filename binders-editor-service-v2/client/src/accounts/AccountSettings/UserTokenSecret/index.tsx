import * as React from "react";
import { TFunction, useTranslation } from "@binders/client/lib/react/i18n";
import Button from "@binders/ui-kit/lib/elements/button";
import CopyButton from "@binders/ui-kit/lib/elements/button/CopyButton";
import { FlashMessages } from "../../../logging/FlashMessages";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import RefreshButton from "@binders/ui-kit/lib/elements/button/RefreshButton";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { generateAccountUserTokenSecret } from "../../actions";
import "../accountsettings.styl";

interface IUserTokenSecretProps {
    accountId: string;
    userTokenSecret?: string;
}

const UserTokenSecret: React.FunctionComponent<IUserTokenSecretProps> = (props) => {
    const { accountId, userTokenSecret } = props;
    const { t }: { t: TFunction } = useTranslation();
    const inputRef = React.useRef(null);
    const [confirmUpdate, setConfirmUpdate] = React.useState(false);

    const updateUserTokenSecret = () => {
        generateAccountUserTokenSecret(accountId);
        setConfirmUpdate(false);
    }

    const onCopySecret = () => {
        if (inputRef.current) {
            const input: HTMLInputElement = inputRef.current;
            input.removeAttribute("disabled");
            input.focus();
            input.select();
            document.execCommand("copy");
            input.setAttribute("disabled", "true");
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
            }
            FlashMessages.info(t(TK.General_TextCopiedToClipboard));
        }
    }

    const renderConfirmUpdateModal = () => (
        <Modal
            title={t(TK.Account_UserTokenSecretConfirmRenew)}
            buttons={[
                <Button key="cancel" secondary={true} text={t(TK.General_Cancel)} onClick={() => setConfirmUpdate(false)} />,
                <Button key="ok" text={t(TK.General_Ok)} onClick={updateUserTokenSecret} />,
            ]}
            onHide={() => setConfirmUpdate(false)}
        >
            <p>{t(TK.Account_UserTokenSecretConfirmRenewText)}</p>
        </Modal>
    )

    return (
        <>
            <div className={cx("media-settings-setting", "media-settings-setting-as-row")}>
                <Input
                    type="text"
                    disabled={true}
                    name="user-token-secret"
                    value={userTokenSecret}
                    setRef={(ref) => { inputRef.current = ref; }}
                />
                <CopyButton onClick={onCopySecret} tooltip={t(TK.General_Copy)} />
                <RefreshButton onClick={() => setConfirmUpdate(true)} tooltip={t(TK.Account_UserTokenSecretRenew)} />
            </div>
            {confirmUpdate && renderConfirmUpdateModal()}
        </>
    );
};

export default UserTokenSecret;
