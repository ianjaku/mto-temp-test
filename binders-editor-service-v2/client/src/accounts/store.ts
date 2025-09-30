import { IWebData, WebData, WebDataState } from "@binders/client/lib/webdata";
import {
    WithThumbnail,
    withParsedThumbnail
} from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { immutableStateFromKeys, updateWebDataState } from "@binders/client/lib/webdata/flux";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import Dispatcher from "@binders/client/lib/react/flux/dispatcher";
import { ReduceStore } from "flux/utils";

export const KEY_MY_ACCOUNTS = "my-accounts";
export const KEY_ACTIVE_ACCOUNT_ID = "active-account";
export const KEY_ACCOUNT_DOMAINS = "active-account-domains";
export const KEY_ACCOUNT_SETTINGS = "active-account-settings";
export const KEY_ACCOUNT_FEATURES = "active-account-features";
export const KEY_ACCOUNT_ROLES = "active-account-roles";
export const KEY_ADMIN_GROUP = "account-admins-group";
export const KEY_ACCOUNT_LICENSING = "action-update-accounts-licensing";
export const KEY_HELP_ACCOUNT = "account-help-account";

export const ACTION_UPDATE_ACCOUNT_VISUAL_SETTINGS = "action-update-account-visual-settings";
export const ACTION_UPDATE_ACCOUNT_MEMBERS = "action-update-account-members";
export const ACTION_UPDATE_ACCOUNT_LANGUAGE_SETTINGS = "action-update-account-language-settings";
export const ACTION_UPDATE_ACCOUNT_PDF_EXPORT_SETTINGS = "action-update-account-pdf-export-settings";
export const ACTION_UPDATE_ACCOUNT_MT_SETTINGS = "action-update-account-mt-settings";
export const ACTION_UPDATE_ACCOUNT_SSO_SETTINGS = "action-update-account-sso-settings";
export const ACTION_UPDATE_ACCOUNT_THUMBNAIL = "action-update-account-thumbnail";
export const ACTION_UPDATE_ACCOUNT_SECURITY_SETTINGS = "action-update-account-security-settings";
export const ACTION_UPDATE_ACCOUNT_AG5_SETTINGS = "action-update-account-ag5-settings";

export const ACTION_GENERATE_ACCOUNT_USER_TOKEN_SECRET = "action-generate-account-user-token-secret";
export const ACTION_UPDATE_SORT_METHOD = "action-update-sort-method";

const ALL_MANAGED_KEYS = [
    KEY_MY_ACCOUNTS,
    KEY_ACCOUNT_DOMAINS,
    KEY_ACCOUNT_SETTINGS,
    KEY_ACCOUNT_ROLES,
    KEY_ACCOUNT_FEATURES,
    KEY_ADMIN_GROUP,
    KEY_ACCOUNT_LICENSING,
    KEY_HELP_ACCOUNT,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AccountStoreState = Immutable.Map<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AccountStorePaylowd = any;

class AccountStore extends ReduceStore<AccountStoreState, AccountStorePaylowd> {

    getInitialState() {
        return immutableStateFromKeys(ALL_MANAGED_KEYS)
            .set(KEY_ACTIVE_ACCOUNT_ID, undefined);
    }

    reduce(state, action) {
        switch (action.type) {
            case ACTION_UPDATE_SORT_METHOD: {
                const updatedAccountSettings = this.getAccountSettings()
                    .lift(accountSettings => ({
                        ...accountSettings,
                        sorting: {
                            sortMethod: action.body
                        }
                    }));
                return state.set(KEY_ACCOUNT_SETTINGS, updatedAccountSettings);
            }
            case ACTION_GENERATE_ACCOUNT_USER_TOKEN_SECRET: {
                const updatedAccountSettings = this.getAccountSettings()
                    .lift(accountSettings => ({
                        ...accountSettings,
                        userTokenSecret: action.body,
                    }));
                return state.set(KEY_ACCOUNT_SETTINGS, updatedAccountSettings);
            }
            case KEY_ACTIVE_ACCOUNT_ID:
                return state.set(KEY_ACTIVE_ACCOUNT_ID, action.body);
            case ACTION_UPDATE_ACCOUNT_VISUAL_SETTINGS: {
                const updatedAccountSettings = this.getAccountSettings()
                    .lift(accountSettings => {
                        accountSettings.visuals = action.body;
                        return accountSettings;
                    });
                return state.set(KEY_ACCOUNT_SETTINGS, updatedAccountSettings);
            }
            case ACTION_UPDATE_ACCOUNT_LANGUAGE_SETTINGS: {
                const updatedAccountS = this.getAccountSettings()
                    .lift(accountSettings => ({
                        ...accountSettings,
                        languages: {
                            ...accountSettings.languages,
                            ...action.body,
                        },
                    }));
                return state.set(KEY_ACCOUNT_SETTINGS, updatedAccountS);
            }
            case ACTION_UPDATE_ACCOUNT_PDF_EXPORT_SETTINGS: {
                const updatedAccountSettings = this.getAccountSettings()
                    .lift(accountSettings => {
                        accountSettings.pdfExport = {
                            ...accountSettings.pdfExport,
                            ...action.body,
                        };
                        return accountSettings;
                    });
                return state.set(KEY_ACCOUNT_SETTINGS, updatedAccountSettings);
            }
            case ACTION_UPDATE_ACCOUNT_MT_SETTINGS: {
                const updatedAccountSettings = this.getAccountSettings()
                    .lift(accountSettings => {
                        accountSettings.mt = {
                            ...accountSettings.mt,
                            ...action.body,
                        };
                        return accountSettings;
                    });
                return state.set(KEY_ACCOUNT_SETTINGS, updatedAccountSettings);
            }
            case ACTION_UPDATE_ACCOUNT_SSO_SETTINGS: {
                const updatedAccountSSO = this.getAccountSettings()
                    .lift(accountSettings => {
                        accountSettings.sso = action.body;
                        return accountSettings;
                    });
                return state.set(KEY_ACCOUNT_SETTINGS, updatedAccountSSO);
            }
            case ACTION_UPDATE_ACCOUNT_SECURITY_SETTINGS: {
                const updatedAccountSecuritySettings = this.getAccountSettings()
                    .lift(accountSettings => {
                        accountSettings.security = action.body;
                        return accountSettings;
                    });
                return state.set(KEY_ACCOUNT_SETTINGS, updatedAccountSecuritySettings);
            }
            case ACTION_UPDATE_ACCOUNT_AG5_SETTINGS: {
                const updatedAccountSecuritySettings = this.getAccountSettings()
                    .lift(accountSettings => {
                        accountSettings.ag5 = action.body;
                        return accountSettings;
                    });
                return state.set(KEY_ACCOUNT_SETTINGS, updatedAccountSecuritySettings);
            }
            case ACTION_UPDATE_ACCOUNT_MEMBERS: {
                const updatedAccounts = this.myAccounts().lift(accounts => {
                    return accounts.map((account) => {
                        if (account.id === action.body.accountId) {
                            return { ...account, members: action.body.members };
                        }
                        return account;
                    });
                });
                return state.set(KEY_MY_ACCOUNTS, updatedAccounts);
            }
            case ACTION_UPDATE_ACCOUNT_THUMBNAIL: {
                const { accountId, visual } = action.body;
                const updatedAccounts = this.myAccounts().lift(accounts => accounts.map(account => {
                    return account.id !== accountId ?
                        account :
                        withParsedThumbnail({
                            ...account,
                            thumbnail: visual,
                        } as Account & WithThumbnail);
                }));
                return state.set(KEY_MY_ACCOUNTS, updatedAccounts);
            }
            default:
                return updateWebDataState(state, action, ALL_MANAGED_KEYS);
        }
    }

    myAccounts(): IWebData<Account[]> {
        return this.getState().get(KEY_MY_ACCOUNTS);
    }

    /**
     * @returns null, when the list of accounts is not yet loaded, and "Accounts[]" when it is.
     */
    myAccountsWithEditAccess(): null | Account[] {
        const accountsWD = this.myAccounts();
        if (accountsWD == null || accountsWD.state !== WebDataState.SUCCESS) return null;
        return accountsWD.data.filter(account => account.canIEdit);
    }

    /**
     * @returns {IWebData<string[] | undefined>}
     */
    getDomains() {
        return this.getState().get(KEY_ACCOUNT_DOMAINS);
    }

    /**
     * @returns {IWebData<IAccountSettings>}
     */
    getAccountSettings() {
        return this.getState().get(KEY_ACCOUNT_SETTINGS);
    }

    /**
     * @returns {IWebData<AccountFeatures>}
     */
    getAccountFeatures() {
        return this.getState().get(KEY_ACCOUNT_FEATURES);
    }

    getAccount(accountId: string): Account | undefined {
        const myAccounts = this.myAccounts();
        return myAccounts.state !== WebDataState.SUCCESS ?
            undefined :
            myAccounts.data.find(account => account.id === accountId);
    }

    getAccountRoles() {
        return this.getState().get(KEY_ACCOUNT_ROLES);
    }

    getActiveAccountId() {
        return this.getState().get(KEY_ACTIVE_ACCOUNT_ID);
    }

    getActiveAccount(): Account | undefined {
        return this.getAccount(this.getActiveAccountId());
    }

    pickFirstAccountId(): undefined | string {
        const myAccounts = this.myAccounts();
        return myAccounts.state !== WebDataState.SUCCESS ?
            undefined :
            myAccounts.data.find(account => account)?.id;
    }

    getAdminGroup() {
        return this.getState().get(KEY_ADMIN_GROUP);
    }

    getAccountLicensing() {
        return this.getState().get(KEY_ACCOUNT_LICENSING);
    }

    getHelpAccount(): WebData<Account> {
        return this.getState().get(KEY_HELP_ACCOUNT);
    }
}

const instance = new AccountStore(Dispatcher);
export default instance;
