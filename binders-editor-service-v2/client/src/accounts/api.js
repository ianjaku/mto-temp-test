import { FEATURE_NOCDN, ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import AccountStore from "./store";
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import i18next from "@binders/client/lib/react/i18n";

const accountClient = AccountServiceClient.fromConfig(config, "v1", browserRequestHandler);
const routingClient = RoutingServiceClient.fromConfig(
    config, "v1",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);
const credentialClient = CredentialServiceClient.fromConfig(config, "v1", browserRequestHandler);
const authorizationClient = AuthorizationServiceClient.fromConfig(config, "v1", browserRequestHandler);

const accountFeatureOverrides = {
};

export const APIMyAccounts = () => {
    const accountFeaturesWD = AccountStore.getAccountFeatures();
    const cdnnify = !((accountFeaturesWD.result || []).includes(FEATURE_NOCDN));
    return accountClient.mine({ cdnnify });
}

export const APIRemoveUserFromAccount = (accountId, userId) => accountClient.removeMember(accountId, userId, ManageMemberTrigger.EDITOR);

export const APIGetAccountDomains = async (accountId) => {
    const filters = await routingClient.getDomainFiltersForAccounts([accountId]);
    const matches = filters
        .map(filter => filter.domain)
        .filter(d => !!d);
    if (matches.length === 0) {
        // eslint-disable-next-line
        console.error(`Could not find domain for account ${accountId}`);
    }
    return matches;
}

export const APIGetAccountIdsForDomain = async (domain) => {
    return routingClient.getAccountIdsForDomain(domain);
}

export function APISetSemanticLink(semanticLink, binderId, overrideInTrash) {
    return routingClient.setSemanticLink(semanticLink, binderId, overrideInTrash);
}

export const APIFindSemanticLinks = (binderId) => {
    return routingClient.findSemanticLinks(binderId);
}

export function APIDeleteSemanticLinks(filter, isSoftDelete = false) {
    return routingClient.deleteSemanticLinks(filter, isSoftDelete);
}

export function APIIdentifyLanguageInSemanticLinks(domain, itemId, languageCode) {
    return routingClient.identifyLanguageInSemanticLinks(domain, itemId, languageCode);
}

export function APIAddUserToAccount(userId, accountId, skipDefaultPermissions) {
    return accountClient.addMember(accountId, userId, ManageMemberTrigger.USER_INVITE, skipDefaultPermissions);
}

export async function APIGetAccountSettings(accountId) {
    const accountSettings = await accountClient.getAccountSettings(accountId);
    try {
        const cert = await credentialClient.getCertificate(accountId);
        if (cert) {
            accountSettings.sso.saml.certificateExpirationDate = new Date(cert.expirationDate);
        }
    } catch (exc) {
        // eslint-disable-next-line no-console
        console.error(exc);
    }
    return accountSettings;
}


export function APIGetAllRolesForAccount(accountId) {
    return authorizationClient.allRolesForAccount(accountId);
}

export async function APIGetAdminGroup(accountId) {
    const group = await authorizationClient.getAdminGroup(accountId);
    return group;
}


export async function APIGetAccountFeatures(accountId) {
    const accountFeatures = await accountClient.getAccountFeatures(accountId);
    const forcedEnabledFeatures = Object.keys(accountFeatureOverrides).reduce((acc, feature) => {
        return (accountFeatureOverrides[feature] === true) ?
            acc.concat(feature) :
            acc;
    }, []);
    return accountFeatures.reduce((acc, feature) => {
        if (!acc.includes(feature) && accountFeatureOverrides[feature] !== false) {
            acc.push(feature);
        }
        return acc;
    }, forcedEnabledFeatures);
}

export function APISetAccountDefaultVisualSettings(accountId, visualSettings) {
    return accountClient.setAccountDefaultVisualSettings(accountId, visualSettings);
}

export function APISetAccountDefaultLanguageSettings(accountId, languageSettings) {
    return accountClient.setAccountDefaultLanguageSettings(accountId, languageSettings);
}


export function APISetAccountDefaultInterfaceLanguage(accountId, languageSettings) {
    return accountClient.setAccountDefaultInterfaceLanguage(accountId, languageSettings);
}

export function APISetAccountDefaultPDFExportSettings(accountId, settings) {
    return accountClient.setAccountDefaultPDFExportSettings(accountId, settings);
}

export function APISetAccountMTSettings(accountId, settings) {
    return accountClient.setAccountMTSettings(accountId, settings);
}

export function APISetAccountSecuritySettings(accountId, settings) {
    return accountClient.setAccountSecuritySettings(accountId, settings);
}

export function APISetAccountAG5Settings(accountId, settings) {
    return accountClient.setAccountAG5Settings(accountId, settings);
}

export function APISetAccountMTSettingsLanguagePair(
    accountId,
    languageCodesSerialized,
    engineType,
    replacesLanguageCodesSerialized,
) {
    return accountClient.setAccountMTSettingsLanguagePair(
        accountId,
        languageCodesSerialized,
        engineType,
        replacesLanguageCodesSerialized
    );
}

export function APIGetAccountLicensing(accountId) {
    return accountClient.getAccountLicensing(accountId);
}
export function APIGetHelpAccount() {
    const accountFeaturesWD = AccountStore.getAccountFeatures();
    const cdnnify = !((accountFeaturesWD.result || []).includes(FEATURE_NOCDN));
    return accountClient.getHelpAccount({ cdnnify });
}

function readCertificate(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target.result.startsWith("-----BEGIN CERTIFICATE-----")) {
                return resolve({ data: e.target.result, name: file.name });
            } else {
                return reject(i18next.t(TK.Account_WrongCertificate))
            }
        }
        reader.readAsText(file);
    })
}

/**
 * @param accountId {string}
 * @param ADGroups {Record<string, string>}
 * @returns {Promise<Awaited<void>[]>}
 */
const APISetADGroupMapping = (accountId, ADGroups) =>
    Promise.all(
        Object.keys(ADGroups).map(
            (key) => credentialClient.saveADGroupMapping(ADGroups[key], key, accountId)
        )
    );

/**
 * @returns {Promise<ISAMLSSOSettings>}
 */
export async function APISetSSOSettings(accountId, { certificate, ADGroups, oldTenantId, ...accountSettings }) {
    if (oldTenantId && oldTenantId !== accountSettings.tenantId) {
        await credentialClient.updateCertificateTenantId(accountId, accountSettings.tenantId);
    }
    let latestCertificate = undefined;
    if (accountSettings.enabled && certificate) {
        const { data, name } = await readCertificate(certificate)
        latestCertificate = await credentialClient.saveCertificate(accountSettings.tenantId, data, name, accountId);
    } else {
        try {
            latestCertificate = await credentialClient.getCertificate(accountId);
        } catch (_) { /* Ignored */ }
    }
    const certificateExpirationDate = latestCertificate?.expirationDate ? new Date(latestCertificate.expirationDate) : undefined;
    await accountClient.setSSOSettings(accountId, accountSettings);
    await APISetADGroupMapping(accountId, ADGroups);
    const ssoSettings = await accountClient.getSSOSettings(accountId);
    return {
        ...ssoSettings,
        certificateExpirationDate,
    };
}

export async function APIGenerateUserTokenSecret(accountId) {
    const userTokenSecret = await accountClient.generateUserTokenSecretForAccountId(accountId);
    return userTokenSecret;
}

export async function APISetAccountSortMethod(accountId, sortMethod) {
    await accountClient.setAccountSortMethod(accountId, sortMethod);
}
