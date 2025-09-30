import {
    Account,
    AccountFeatures,
    AccountSortMethod,
    FEATURE_AUTOMATED_ITEM_SORTING,
    IAccountSettings,
    IFeature
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import AccountStore from "./store";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { Role } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { WebDataState } from "@binders/client/lib/webdata";
import { activateAccountId } from "./actions";
import { clearBrowseItems } from "../documents/actions";
import { fetchLaunchDarklyFlags } from "./ts-api";
import { isProduction } from "@binders/client/lib/util/environment";
import { useCallback } from "react";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";

export const useActiveAccount = (): Account | undefined => {
    return useFluxStoreAsAny(
        AccountStore,
        (_prev, store) => store.getActiveAccount()
    );
}

export const useActiveAccountId = (): string => {
    return useFluxStoreAsAny(
        AccountStore,
        (_prev, store) => store.getActiveAccountId()
    );
}

export const useActiveAccountFeatures = (): AccountFeatures => {
    return useFluxStoreAsAny(
        AccountStore,
        (_prevState, store) => store.getAccountFeatures()?.status === WebDataState.SUCCESS ? (store.getAccountFeatures().data) : []
    );
}

export const useIsAccountFeatureActive = (feature: IFeature): boolean => {
    const activeFeatures = useActiveAccountFeatures();
    return activeFeatures.includes(feature);
}

export const useActiveAccountSettings = (): IAccountSettings => {
    return useFluxStoreAsAny(
        AccountStore,
        (_prev, store) => {
            const accountSettings = store.getAccountSettings();
            return accountSettings?.state === WebDataState.SUCCESS ? accountSettings.data : {};
        }
    );
}

export const useCurrentDomain = (): string | null => {
    const domainsWD = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getDomains()) as { state: unknown, data: string[] };
    const domains = domainsWD.state === WebDataState.SUCCESS && domainsWD.data;
    return (domains && domains.length > 0 && domains[0]) || null;
}

export const useAccountRoles = (): Role[] => {
    return useFluxStoreAsAny(
        AccountStore,
        (_prevState, store) => store.getAccountRoles()?.status === WebDataState.SUCCESS && store.getAccountRoles().data
    );
}

export const useReloadAccount = (): (accountId: string) => void => {
    const load = useCallback(async (accountId: string) => {
        clearBrowseItems();
        const shouldSwitchUrl = isProduction();
        if (!shouldSwitchUrl) {
            activateAccountId(accountId);
        }
    }, []);
    return load;
}

export function useIsSortingEnabled() {
    const accountSettings = useActiveAccountSettings();
    const accountFeatures = useActiveAccountFeatures();
    const sortMethod = accountSettings?.sorting?.sortMethod ?? "default";
    return (
        accountFeatures?.includes(FEATURE_AUTOMATED_ITEM_SORTING) &&
        sortMethod !== AccountSortMethod.None
    );
}

export const useFetchLaunchDarklyFlags = (): UseQueryResult<Record<LDFlags, unknown>> => {
    const accountId = useActiveAccountId();
    return useQuery({
        queryFn: () => fetchLaunchDarklyFlags(accountId),
        queryKey: ["launchDarklyFlags", accountId],
        enabled: !!accountId,
    });
}
