import {
    APIGenerateUserTokenSecret,
    APIGetAccountDomains,
    APIGetAccountFeatures,
    APIGetAccountIdsForDomain,
    APIGetAccountLicensing,
    APIGetAccountSettings,
    APIGetAdminGroup,
    APIGetAllRolesForAccount,
    APIGetHelpAccount,
    APIMyAccounts,
    APISetAccountAG5Settings,
    APISetAccountDefaultInterfaceLanguage,
    APISetAccountDefaultLanguageSettings,
    APISetAccountDefaultPDFExportSettings,
    APISetAccountDefaultVisualSettings,
    APISetAccountMTSettings,
    APISetAccountMTSettingsLanguagePair,
    APISetAccountSecuritySettings,
    APISetSSOSettings
} from "./api";
import AccountStore, {
    ACTION_GENERATE_ACCOUNT_USER_TOKEN_SECRET,
    ACTION_UPDATE_ACCOUNT_AG5_SETTINGS,
    ACTION_UPDATE_ACCOUNT_LANGUAGE_SETTINGS,
    ACTION_UPDATE_ACCOUNT_MEMBERS,
    ACTION_UPDATE_ACCOUNT_MT_SETTINGS,
    ACTION_UPDATE_ACCOUNT_PDF_EXPORT_SETTINGS,
    ACTION_UPDATE_ACCOUNT_SECURITY_SETTINGS,
    ACTION_UPDATE_ACCOUNT_SSO_SETTINGS,
    ACTION_UPDATE_ACCOUNT_THUMBNAIL,
    ACTION_UPDATE_ACCOUNT_VISUAL_SETTINGS,
    KEY_ACCOUNT_DOMAINS,
    KEY_ACCOUNT_FEATURES,
    KEY_ACCOUNT_LICENSING,
    KEY_ACCOUNT_ROLES,
    KEY_ACCOUNT_SETTINGS,
    KEY_ACTIVE_ACCOUNT_ID,
    KEY_ADMIN_GROUP,
    KEY_HELP_ACCOUNT,
    KEY_MY_ACCOUNTS
} from "./store";
import { getMappedUserGroupsKey, invalidateQuery } from "../users/query";
import {
    safeLocalStorageGetItem,
    safeLocalStorageSetItem
} from "@binders/client/lib/localstorage";
import DebugLog from "@binders/client/lib/util/debugLogging";
import { FlashMessages } from "../logging/FlashMessages";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { WebDataState } from "@binders/client/lib/webdata";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { getAccountDomain } from "@binders/client/lib/util/domains";
import { getCurrentUserId } from "../stores/my-details-store";
import { getWebDataActionType } from "@binders/client/lib/webdata/flux";
import i18next from "@binders/client/lib/react/i18n";
import { isAdminImpersonatedSession } from "../stores/impersonation-store";
import { logUserIsOnline } from "../tracking/actions";
import { normalizeRoles } from "./helpers";
import { prefetchMyPermissionMap } from "../authorization/hooks";
import { retrieveMostUsedLanguages } from "../documents/actions";
import { wrapAction } from "../shared/fluxwebdata";

export const fetchAllMyAccounts = async () => {

    const domainToCheck = window.bindersConfig.domain || window.location.hostname;
    const allMyAccountsPromise = APIMyAccounts();
    if (domainToCheck.endsWith(".editor.manual.to")) {
        const readerDomain = getAccountDomain(domainToCheck);
        const validAccountIdsPromise = APIGetAccountIdsForDomain(readerDomain);
        const [allMyAccounts, validAccountIds] = await Promise.all([
            allMyAccountsPromise, validAccountIdsPromise
        ]);
        let accountForEditorDomainIncluded = false;
        // put valid Account Ids on top
        const fullList = allMyAccounts.reduce((prev, account) => {
            if (validAccountIds.indexOf(account.id) >= 0) {
                accountForEditorDomainIncluded = true;
                return [{ ...account, shouldActivate: true }, ...prev];
            }
            return [...prev, account];
        }, []);
        return accountForEditorDomainIncluded ? fullList : [];
    }
    return await allMyAccountsPromise;
}

export const myAccounts = async () => {
    const toWrap = async () => {
        const mostRecentAccountId = getMostRecentlyUsedAccount();
        await loadHelpAccount();
        const allMyAccounts = await fetchAllMyAccounts();
        const accounts = allMyAccounts;
        if (!accounts || !accounts.length) {
            return [];
        }
        const toActivate = accounts[0].shouldActivate ?
            accounts[0] :
            (mostRecentAccountId && accounts.find(a => a.id === mostRecentAccountId));
        const toActivateId = (toActivate && toActivate.canIEdit) ?
            toActivate.id :
            accounts[0].id;
        activateAccountId(toActivateId);
        return accounts;
    };
    return wrapAction(
        toWrap,
        KEY_MY_ACCOUNTS,
        i18next.t(TK.Account_CantLoad)
    );
}

const writeAccountIdToStorage = (accountId) => {
    try {
        if (!accountId) {
            return;
        }
        const used = getLastUsedAccountIds()
            .filter(a => a !== accountId)
        const start = Math.max(0, used.length - 9);
        const slicedUsed = used.slice(start, 9);
        slicedUsed.push(accountId);
        safeLocalStorageSetItem(ACCOUNTS_USED, JSON.stringify(slicedUsed));
    } catch (err) {
        // eslint-disable-next-line
        console.error(err);
    }
}

const ACCOUNTS_USED = "ACCOUNT_SWITCHER_USED";

export const getLastUsedAccountIds = () => {
    try {
        const encoded = safeLocalStorageGetItem(ACCOUNTS_USED) || "[]";
        return JSON.parse(encoded);
    } catch (err) {
        // eslint-disable-next-line
        console.error(err);
        return [];
    }
}

export const getMostRecentlyUsedAccount = () => {
    const lastUsed = getLastUsedAccountIds();
    if (lastUsed.length > 0) {
        return lastUsed[lastUsed.length - 1];
    }
    return undefined;
}

export const activateAccountId = (accountId) => {
    if (AccountStore.getActiveAccountId() === accountId) {
        return;
    }
    writeAccountIdToStorage(accountId);
    prefetchMyPermissionMap(accountId);
    loadAccountSettings(accountId);
    dispatch({
        type: KEY_ACTIVE_ACCOUNT_ID,
        body: accountId
    });
    loadAccountLicensing(accountId);
    logUserIsOnline(accountId, getCurrentUserId(), isAdminImpersonatedSession(), true);
    getDomainsForAccount(accountId);
    retrieveMostUsedLanguages(accountId);
}


/**
* @returns {Promise<string[]>}
*/
export const getDomainsForAccount = (accountId) => {
    const toWrap = () => APIGetAccountDomains(accountId);
    return wrapAction(
        toWrap,
        KEY_ACCOUNT_DOMAINS,
        i18next.t(TK.Account_CantLoadDomains)
    );
}

export const updateAccountMembers = (accountId, members) => {
    dispatch({
        type: ACTION_UPDATE_ACCOUNT_MEMBERS,
        body: { accountId, members }
    });
}

export const loadAccountSettings = (accountId) => {
    return wrapAction(
        () => APIGetAccountSettings(accountId),
        KEY_ACCOUNT_SETTINGS,
        i18next.t(TK.Account_CantLoadSettings)
    );
}

export const loadAllAccountRoles = (accountId, includeContributorRole, includeReviewerRole) => {
    return wrapAction(
        async () => {
            let allRoles = await APIGetAllRolesForAccount(accountId);
            return normalizeRoles(allRoles, includeContributorRole, includeReviewerRole);
        },
        KEY_ACCOUNT_ROLES,
        i18next.t(TK.Account_CantLoadRoles)
    );
}

export const clearAccountFeatures = async () => {
    dispatch(
        {
            type: getWebDataActionType(KEY_ACCOUNT_FEATURES, WebDataState.PENDING),
            body: [],
        }
    );
}

/**
 * @returns {Promise<AccountFeatures>}
 */
export const loadAccountFeatures = async (accountId) => {
    let features;
    try {
        features = await APIGetAccountFeatures(accountId);
    } catch (e) {
        features = Promise.reject(e);
    }
    DebugLog.setDebugFeature(features);
    wrapAction(
        () => features,
        KEY_ACCOUNT_FEATURES,
        i18next.t(TK.Account_CantLoadSettings)
    );
    return features;
}


export const getAdminGroup = async (accountId) => {
    return wrapAction(
        () => APIGetAdminGroup(accountId),
        KEY_ADMIN_GROUP,
        i18next.t(TK.Account_CantLoadAdminGroup)
    );
}

export const loadAccountLicensing = (accountId) => wrapAction(
    () => APIGetAccountLicensing(accountId),
    KEY_ACCOUNT_LICENSING,
    i18next.t(TK.Account_CantLoadLicensing),
);

export const setDefaultVisualSettings = (accountId, visualSettings) => {
    try {
        APISetAccountDefaultVisualSettings(accountId, visualSettings);
    } catch (err) {
        FlashMessages.error(i18next.t(TK.Account_SettingUpdateError, { error: err.message || err }));
    }
    dispatch({
        type: ACTION_UPDATE_ACCOUNT_VISUAL_SETTINGS,
        body: visualSettings
    });
}

export const setDefaultLanguageSettings = (accountId, languageSettings) => {
    try {
        APISetAccountDefaultLanguageSettings(accountId, languageSettings);
    } catch (err) {
        FlashMessages.error(i18next.t(TK.Account_SettingUpdateError, { error: err.message || err }));
    }
    dispatch({
        type: ACTION_UPDATE_ACCOUNT_LANGUAGE_SETTINGS,
        body: languageSettings
    });
}

export const setDefaultInterfaceLanguage = (accountId, languageSettings) => {
    try {
        APISetAccountDefaultInterfaceLanguage(accountId, languageSettings);
    } catch (err) {
        FlashMessages.error(i18next.t(TK.Account_SettingUpdateError, { error: err.message || err }));
    }
    dispatch({
        type: ACTION_UPDATE_ACCOUNT_LANGUAGE_SETTINGS,
        body: languageSettings
    });
}

export const setDefaultPDFExportSettings = async (accountId, settings) => {
    try {
        await APISetAccountDefaultPDFExportSettings(accountId, settings);
    } catch (err) {
        FlashMessages.error(i18next.t(TK.Account_SettingUpdateError, { error: err.message || err }));
    }
    dispatch({
        type: ACTION_UPDATE_ACCOUNT_PDF_EXPORT_SETTINGS,
        body: settings
    });
}

export const setMTSettings = async (accountId, settings) => {
    try {
        await APISetAccountMTSettings(accountId, settings);
    } catch (err) {
        FlashMessages.error(i18next.t(TK.Account_SettingUpdateError, { error: err.message || err }));
    }
    dispatch({
        type: ACTION_UPDATE_ACCOUNT_MT_SETTINGS,
        body: settings
    });
}

export const setSecuritySettings = async (accountId, settings) => {
    try {
        await APISetAccountSecuritySettings(accountId, settings);
    } catch (err) {
        FlashMessages.error(i18next.t(TK.Account_SettingUpdateError, { error: err.message || err }));
    }
    dispatch({
        type: ACTION_UPDATE_ACCOUNT_SECURITY_SETTINGS,
        body: settings,
    });
}

export const setAG5Settings = async (accountId, settings) => {
    try {
        await APISetAccountAG5Settings(accountId, settings);
        dispatch({ type: ACTION_UPDATE_ACCOUNT_AG5_SETTINGS, body: settings });
    } catch (err) {
        FlashMessages.error(i18next.t(TK.Account_SettingUpdateError, { error: err.message || err }));
    }
}


export const setMTSettingsLanguagePair = async (
    accountId,
    languageCodesSerialized,
    engineType,
    replacesLanguageCodesSerialized
) => {
    try {
        const settings = await APISetAccountMTSettingsLanguagePair(
            accountId,
            languageCodesSerialized,
            engineType,
            replacesLanguageCodesSerialized,
        );
        dispatch({
            type: ACTION_UPDATE_ACCOUNT_MT_SETTINGS,
            body: settings
        });
    } catch (err) {
        FlashMessages.error(i18next.t(TK.Account_SettingUpdateError, { error: err.message || err }));
    }
}

/**
 * @param accountId {string}
 * @param SSOsettings
 * @returns {Promise<void>}
 */
export const setSSOSettings = async (accountId, SSOsettings) => {
    const updatedSSOSettings = await APISetSSOSettings(accountId, SSOsettings);
    dispatch({
        type: ACTION_UPDATE_ACCOUNT_SSO_SETTINGS,
        body: { saml: updatedSSOSettings }
    });
    invalidateQuery(getMappedUserGroupsKey(accountId));
}

export const loadHelpAccount = async () => {
    return wrapAction(
        () => APIGetHelpAccount(),
        KEY_HELP_ACCOUNT,
        i18next.t(TK.Account_CantLoadSettings)
    );
}

export const generateAccountUserTokenSecret = async (accountId) => {
    const userTokenSecret = await APIGenerateUserTokenSecret(accountId);
    dispatch({
        type: ACTION_GENERATE_ACCOUNT_USER_TOKEN_SECRET,
        body: userTokenSecret,
    });
}

export const updateAccountThumbail = (accountId, visual) => {
    dispatch({
        type: ACTION_UPDATE_ACCOUNT_THUMBNAIL,
        body: {
            accountId,
            visual,
        },
    });
}
