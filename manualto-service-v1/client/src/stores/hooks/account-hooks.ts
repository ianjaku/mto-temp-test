import type { AccountFeatures, IAccountSettings, IFeature } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    FEATURE_DOWNLOAD_PDF_FROM_READER,
    FEATURE_LIVE_TRANSLATION_ON_READER,
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { loadAccountSettings } from "../actions/account";
import { loadAvailableTranslations } from "../../binders/binder-loader";
import { useAccountStoreState } from "../zustand/account-store";
import { useEffect } from "react";

export const useActiveAccountFeatures = (): AccountFeatures => {
    const features = useAccountStoreState(state => state.features);
    return features;
}

export const useActiveAccountId = (): string => {
    const accountId = useAccountStoreState(state => state.accountId);
    return accountId;
}

export const useActiveAccountSettings = (): IAccountSettings => {
    const settings = useAccountStoreState(state => state.settings);
    return settings;
}

export const useIsAccountFeatureActive = (feature: IFeature): boolean => {
    const activeFeatures = useActiveAccountFeatures();
    return activeFeatures.includes(feature);
}

export function useActivateFeatures(props: {
    accountFeatures: AccountFeatures;
    accountId: string;
    userId: string;
}) {
    const { accountFeatures, accountId, userId } = props;

    useEffect(() => {
        if (!accountFeatures) {
            return;
        }
        if (accountFeatures.includes(FEATURE_LIVE_TRANSLATION_ON_READER)) {
            loadAvailableTranslations();
        }
    }, [accountFeatures])

    useEffect(() => {
        if (!accountFeatures || !accountId) {
            return;
        }
        if (accountFeatures.includes(FEATURE_DOWNLOAD_PDF_FROM_READER)) {
            loadAccountSettings(accountId, !userId || userId === "public");
        }
    }, [accountFeatures, accountId, userId]);
}
