/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NonEmptyString, tcombValidate, validateWithString, validationOk } from "../../validation";
import { ManageMemberTrigger } from "./contract";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

/* tslint:disable:no-any */

export const VisualAccountSettingsStructure = t.struct({
    fitBehaviour: t.String,
    bgColor: t.maybe(t.String),
    audioEnabled: t.maybe(t.Boolean),
});

export const LanguageAccountSettingsStructure = t.struct({
    defaultCode: t.maybe(t.String),
    interfaceLanguage: t.maybe(t.String),
});

export const ssoSettingsStructure = t.struct({
    tenantId: t.maybe(t.String),
    enabled: t.maybe(t.Boolean),
    issuer: t.maybe(t.String),
    certificateName: t.maybe(t.String),
    entryPoint: t.maybe(t.String),
});

// all the required fields for the syncEntraGroupMembersJob to run
export const ssoAccountSettingsForSyncEntraJobStructure = t.struct({
    enabled: t.refinement(t.Boolean, v => v === true),
    tenantId: t.String,
    enterpriseApplicationId: t.String,
    enterpriseApplicationGroupReadSecret: t.String,
    userGroupIdForUserManagement: t.String,
});

export const PDFExportAccountSettingsStructure = t.struct({
    renderOnlyFirstCarrouselItem: t.maybe(t.Boolean),
});

export const SecurityAccountSettingsStructure = t.struct({
    autoLogout: t.maybe(t.Boolean),
    autoLogoutPeriodMinutes: t.maybe(t.Number),
});

export const MTAccountSettingsStructure = t.struct({
    generalOrder: t.list(t.enums.of([0, 1, 2])),
    pairs: t.maybe(t.Object),
})

export const AG5AccountSettingsStructure = t.struct({
    apiKey: NonEmptyString,
});

export const createMSAccountSetupRequestParamsStructure = t.struct({
    purchaseIdToken: t.String,
    firstName: t.String,
    lastName: t.String,
    phone: t.String,
    companyName: t.String,
    companySite: t.String,
    email: t.String
})

export const createTTSVoiceOptions = t.struct({
    language: t.String,
    name: t.maybe(t.String),
    gender: t.maybe(t.String)
})

/* tslint:disable-next-line:variable-name */

export function validateVisualAccountSettings(visualAccountSettingsCandidate): string[] {
    return tcombValidate(visualAccountSettingsCandidate, VisualAccountSettingsStructure);
}
export function validateLanguageAccountSettings(languageAccountSettingsCandidate): string[] {
    return tcombValidate(languageAccountSettingsCandidate, LanguageAccountSettingsStructure);
}
export function validatePDFExportAccountSettings(settingsCandidate): string[] {
    return tcombValidate(settingsCandidate, PDFExportAccountSettingsStructure);
}
export function validateSecurityAccountSettings(settingsCandidate): string[] {
    return tcombValidate(settingsCandidate, SecurityAccountSettingsStructure);
}
export function validateMTAccountSettings(settingsCandidate): string[] {
    return tcombValidate(settingsCandidate, MTAccountSettingsStructure);
}
export function validateSSOAccountSettings(ssoSettingsCandidate): string[] {
    return tcombValidate(ssoSettingsCandidate, ssoSettingsStructure);
}
export function validateSSOAccountSettingsForSyncEntraJob(ssoSettingsCandidate): string[] {
    return tcombValidate(ssoSettingsCandidate, ssoAccountSettingsForSyncEntraJobStructure);
}
export function validateAG5AccountSettings(ag5SettingsCandidate): string[] {
    return tcombValidate(ag5SettingsCandidate, AG5AccountSettingsStructure);
}
export function validateManageMemberTrigger(candidate): string[] {
    return validateWithString(`${candidate}`, candidate => {
        if (Object.keys(ManageMemberTrigger).includes(candidate)) {
            return validationOk;
        }
        return [`Invalid ManageMemberTrigger: ${candidate}`];
    });
}
export function validateCreateMSAccountSetupRequestParams(params): string[] {
    return tcombValidate(params, createMSAccountSetupRequestParamsStructure);
}
export function validateTTSVoiceOptions(params): string[] {
    return tcombValidate(params, createTTSVoiceOptions);
}