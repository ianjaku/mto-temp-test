import * as React from "react";
import { useActiveAccountFeatures, useActiveAccountId } from "../../stores/hooks/account-hooks";
import { useGeneratePublicApiToken, usePublicApiToken } from "../../helpers/hooks/publicApiHooks";
import CopyToClipboardIcon from "@binders/ui-kit/lib/elements/icons/CopyClipboard";
import { FC } from "react";
import { FEATURE_PUBLIC_API } from "@binders/client/lib/clients/accountservice/v1/contract";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import RefreshIcon from "@binders/ui-kit/lib/elements/icons/Refresh";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { infoRoute } from "./navigation";
import { useHistory } from "react-router-dom";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./publicapi.styl";

export const PublicApiSettings: FC = () => {
    const { t } = useTranslation();
    const accountId = useActiveAccountId();
    const { isLoading, data: token } = usePublicApiToken(accountId);
    const { mutate: generateNewToken } = useGeneratePublicApiToken(accountId);
    const features = useActiveAccountFeatures();
    const history = useHistory();

    const copyToClipboard = () => {
        if (token == null) return;
        navigator.clipboard.writeText(token);
        FlashMessageActions.info(
            t(TK.General_TextCopiedToClipboard),
            3000
        );
    }

    if (!features?.includes(FEATURE_PUBLIC_API)) {
        history.push(infoRoute);
    }
    
    return (
        <div className="userDetails-layout">
            <div className="userDetails-title">
                {t(TK.User_PublicApi)}
            </div>
            <div className="userDetails-row">
                <div className="userDetails-label">
                    {t(TK.User_PublicApiSecretKey)}
                </div>
                <div
                    className="publicApiSettings-inputWrapper"
                >
                    <input
                        data-private-always
                        disabled
                        type="text"
                        className="publicApiSettings-input"
                        value={token ?? ""}
                        onClick={() => copyToClipboard()}
                        onChange={e => e.preventDefault()} // Can't use disabled, because then we don't have click events
                    />
                    {token == null && !isLoading && (
                        <button
                            onClick={() => generateNewToken({})}
                            className="publicApiSettings-inputLink"
                        >
                            {t(TK.User_PublicApiGenerateKeyButton)}
                        </button>
                    )}
                    <div
                        className="publicApiSettings-icon publicApiSettings-icon--nr2"
                        onClick={() => copyToClipboard()}
                    >
                        <CopyToClipboardIcon />
                    </div>
                    <div
                        className="publicApiSettings-icon"
                        onClick={() => generateNewToken({})}
                    >
                        <RefreshIcon hoverColor="#333" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PublicApiSettings;