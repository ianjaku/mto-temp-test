import * as React from "react";
import CountdownModal from "@binders/ui-kit/lib/compounds/countdownModal/CountdownModal";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useCallback } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";

interface Props {
    resetInactivity: () => void;
    redirectBack: (lockedByInfo: boolean) => void;
}

const INACTIVITY_MAX_TIME_SECONDS = 60;

const InactivityModal: React.FC<Props> = ({
    resetInactivity,
    redirectBack,
}) => {

    const { t }: { t: TFunction } = useTranslation();

    const onCountZero = useCallback(() => {
        redirectBack(false);
    }, [redirectBack]);

    return (
        <CountdownModal
            onCancel={resetInactivity}
            onCountZero={onCountZero}
            startSeconds={INACTIVITY_MAX_TIME_SECONDS}
            modalTitle={t(TK.Edit_ExpireInfoTitle)}
            modalMsgTranslationKey={TK.Edit_ExpireInfo}
            cancelLabel={t(TK.Edit_ExpireStay)}
        />
    )
}

export default InactivityModal;