import {
    AccountFeatures,
    IAccountSettings,
    IFeature,
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { createStore, useStore } from "zustand";

export enum EditorCapability {
    No = "no",
    YesHere = "yes-here",
    YesElsewhere = "yes-else",
}

export type AccountStoreActions = {
    loadAccessibleAccountIds: (accountId: AccountStoreState["accessibleAccountIds"]) => void;
    loadFeatures: (features: AccountStoreState["features"]) => void;
    loadSettings: (settings: AccountStoreState["settings"]) => void;
    loadDocsToEdit: (docsToEdit: AccountStoreState["docsToEdit"]) => void;
    setAccountId: (accountId: AccountStoreState["accountId"]) => void;
    setCanEditElsewhere: () => void;
};

export type AccountStoreState = {
    accessibleAccountIds: string[];
    accountId?: string;
    amIEditor: EditorCapability;
    canEditElsewhere: boolean;
    docsToEdit: string[];
    features: AccountFeatures;
    settings: IAccountSettings;
};

type AccountStore = AccountStoreState & { actions: AccountStoreActions; };

export const AccountStoreGetters = {
    /**
    * @deprecated use hook functions instead
    */
    featuresCdn() {
        return !getAccountStoreState().features.includes("disable_cdn");
    },
    /**
    * @deprecated use hook functions instead
    */
    features(feature: IFeature) {
        return getAccountStoreState().features.includes(feature);
    },
    /**
    * @deprecated use hook functions instead
    */
    getAccountFeatures() {
        return getAccountStoreState().features;
    },
    getActiveAccountId() {
        return getAccountStoreState().accountId;
    },
}

const accountStore = createStore<AccountStore>(set => ({
    accessibleAccountIds: [],
    accountId: undefined,
    amIEditor: EditorCapability.No,
    canEditElsewhere: false,
    docsToEdit: [],
    features: [],
    settings: {
        sso: undefined,
        mt: undefined,
        sorting: undefined,
        visuals: undefined,
        languages: undefined,
        pdfExport: undefined
    },
    actions: {
        loadAccessibleAccountIds(accessibleAccountIds) {
            set(prev => ({ ...prev, accessibleAccountIds, accountId: accessibleAccountIds?.at(0) }))
        },
        loadDocsToEdit(docsToEdit) {
            set(prev => ({ ...prev, docsToEdit }));
        },
        loadFeatures(features) {
            set(prev => ({ ...prev, features }));
        },
        loadSettings(settings) {
            set(prev => ({ ...prev, settings }));
        },
        setAccountId(accountId) {
            set(prev => ({ ...prev, accountId }));
        },
        setCanEditElsewhere() {
            set(prev => ({ ...prev, canEditElsewhere: true }))
        },
    },
}));

export function getAccountStoreActions(): AccountStoreActions {
    return accountStore.getState().actions;
}

function getAccountStoreState(): AccountStoreState {
    return accountStore.getState();
}

/** @deprecated Use useAccountStoreState with a selector to **prevent unnecessary rerenders** and **don't select multiple props** */
export function useAccountStoreState(): AccountStoreState;
export function useAccountStoreState<T>(selector: (state: AccountStore) => T): T;
export function useAccountStoreState<T>(selector?: (state: AccountStore) => T) {
    return useStore(accountStore, selector);
}
