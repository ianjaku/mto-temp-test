import * as React from "react";
import { FC, useEffect, useRef } from "react";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { TranslationKeys } from "@binders/client/lib/i18n/translations";
import { useAccountStoreState } from "../zustand/account-store";
import { useActivateFeatures } from "./account-hooks";
import { useCurrentUserId } from "./user-hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const ActivateFeaturesSideEffect: FC = () => {
    const features = useAccountStoreState(state => state.features);
    const accountId = useAccountStoreState(state => state.accountId);
    const userId = useCurrentUserId();
    useActivateFeatures({
        accountFeatures: features,
        accountId,
        userId,
    })
    return <></>;
}

function useBypassChecklistBlockModeToast(
    isBypassChecklistBlockMode: boolean,
    disableBypassChecklistBlockMode: () => void
) {
    const { t } = useTranslation();
    const toastKeyRef = useRef<string>(null)
    useEffect(() => {
        if (toastKeyRef.current) return;
        if (isBypassChecklistBlockMode) {
            const key = FlashMessageActions.info(
                t(TranslationKeys.Reader_ChecklistProgressBypassBlockInfo),
                10000,
                [{
                    text: t(TranslationKeys.Reader_ChecklistProgressBypassBlockDisable),
                    onClick: disableBypassChecklistBlockMode,
                    clickDismissesMessage: true,
                }]
            );
            toastKeyRef.current = key;
        }
    }, [isBypassChecklistBlockMode, disableBypassChecklistBlockMode, t, toastKeyRef]);
}

export const BypassChecklistBlockModeSideEffect: FC<{
    enabled: boolean; disable: () => void
}> = ({ enabled, disable }) => {
    useBypassChecklistBlockModeToast(enabled, disable);
    return <></>;
}
