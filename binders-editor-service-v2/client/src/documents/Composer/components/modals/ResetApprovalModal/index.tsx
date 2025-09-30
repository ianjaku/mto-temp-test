import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { getLanguageName } from "@binders/client/lib/languages/helper";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./reset-approval-modal.styl";
const { useMemo } = React;

const ResetApprovalModal: React.FC<ModalProps<{
    isMulti: boolean,
    chunkCount: number,
    affectedLanguageCodes: string[],
}, boolean>> = ({ hide, params }) => {
    const { t } = useTranslation();

    const infoMsg = useMemo(() => {
        const isSingleUndefinedLang = params.affectedLanguageCodes.length === 1 && params.affectedLanguageCodes[0] === UNDEFINED_LANG;
        if (isSingleUndefinedLang) {
            return (
                <span>
                    {t(TK.Visual_UpdateWithApprovalsConfirmInfoUndef, { count: params.chunkCount })}
                </span>
            );
        }
        const affectedLanguageNames = params.affectedLanguageCodes.map(code => getLanguageName(code));
        return params.affectedLanguageCodes.length > 1 ?
            (
                <>
                    <span>
                        {t(TK.Visual_UpdateWithApprovalsConfirmInfoMulti, { count: params.chunkCount })}
                    </span>
                    <span>
                        {affectedLanguageNames.join(", ")}
                    </span>
                </>
            ) :
            (
                <span>
                    {t(TK.Visual_UpdateWithApprovalsConfirmInfo, { count: params.chunkCount, languageName: affectedLanguageNames[0] })}
                </span>
            );
    }, [params, t]);

    const msgBody = useMemo(() => {
        return (
            <>
                <div>
                    {infoMsg}
                </div>
                <div>
                    {t(TK.Visual_UpdateWithApprovalsConfirmQ, { count: params.chunkCount })}
                </div>
            </>
        );
    }, [infoMsg, params, t]);

    return (
        <Modal
            title={t(TK.Visual_UpdateWithApprovalsTitle)}
            buttons={[
                <Button text={t(TK.General_No)} secondary onClick={() => hide(false)} />,
                <Button text={t(TK.General_Yes)} CTA={true} onClick={() => hide(true)} />,
            ]}
            classNames="ResetApprovalModal"
        >
            {msgBody}
        </Modal>
    );
}

export default ResetApprovalModal;