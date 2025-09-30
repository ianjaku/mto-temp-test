import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button"
import Icon from "@binders/ui-kit/lib/elements/icons";
import { Markdown } from "@binders/ui-kit/lib/elements/Markdown";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { getEditorLocation } from "@binders/client/lib/util/domains";
import { getReaderDomain } from "../../util";
import { loadAmIEditorElsewhere } from "../../stores/actions/account";
import { useActiveAccountId } from "../../stores/hooks/account-hooks";
import { useCanEditAnything } from "../../helpers/hooks/useAmIEditor";
import { useCurrentUserId } from "../../stores/hooks/user-hooks";
import { useEffect } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./EmptyAccount.styl"

export const EmptyAccount = () => {
    const { t } = useTranslation();
    const canEditAnything = useCanEditAnything();
    const accountId = useActiveAccountId();
    const userId = useCurrentUserId();
    const goToEditor = () => {
        const url = getEditorLocation(getReaderDomain());
        if (url) {
            const win = window.open(url, "_blank");
            if (win) {
                win.focus();
            }
        }
    }
    useEffect(() => {
        if (!accountId || !userId) return;
        loadAmIEditorElsewhere(accountId, userId);
    }, [accountId, userId])

    return (
        <div className="empty-account">
            <div className="empty-account-container">
                <div className="empty-account-icon">
                    <Icon name="description" />
                </div>
                <div className="empty-account-message">
                    <p className="empty-account-title">{t(TK.Reader_EmptyAccount)}</p>
                    <Markdown className="empty-account-description" element="p">
                        {canEditAnything ?
                            t(TK.Reader_EmptyAccountDescriptionEditor) :
                            t(TK.Reader_EmptyAccountDescription)}
                    </Markdown>
                </div>
                {canEditAnything && <div className="empty-account-buttons">
                    <Button
                        CTA
                        text={t(TK.General_GetStarted)}
                        iconRight={<Icon name="arrow_forward" />}
                        onClick={goToEditor}
                        aria-label={t(TK.General_GetStarted)}
                        role="link"
                    />
                </div>}
            </div>
        </div>
    );

}
