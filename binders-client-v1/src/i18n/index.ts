import {
    AccountFeatures,
    FEATURE_INTERFACE_I18N,
    IAccountSettings
} from "../clients/accountservice/v1/contract";
import { de, enUS, fr, nl } from "date-fns/locale";
import i18next, { TFunction as TF } from "i18next";
import { UserPreferences } from "../clients/userservice/v1/contract";
import { i18nextResources } from "./resources";
import { initReactI18next } from "react-i18next";
import { setDefaultOptions as setDefaultDateFnsOptions } from "date-fns";

export const defaultLanguage = "en";
export type TFunction = TF;

i18next
    .use(initReactI18next)
    .init({
        lng: defaultLanguage,
        fallbackLng: defaultLanguage,
        debug: false,
        resources: i18nextResources,
        interpolation: {
            escapeValue: false,
            skipOnVariables: false,
        },
    });

export default i18next;

/**
 * Default Date-fns options
 * "weekStartsOn": 1 means the week starts on Monday (1 = Monday, 0 = Sunday)
 */
setDefaultDateFnsOptions({ weekStartsOn: 1 });
const setDateFnsLocale = (language: string) => {
    const localeMap = {
        "en": enUS,
        "nl": nl,
        "de": de,
        "fr": fr
    }

    const locale = localeMap[language];
    if (locale == null) {
        throw new Error(`No date-fns locale exists (or is set up in i18n/index.ts) for the language ${language}`);
    }
    setDefaultDateFnsOptions({
        weekStartsOn: 1,
        locale,
    });
}

export const switchInterfaceLanguage = (language: string | null | undefined): void => {
    if (!language) {
        return;
    }
    i18next.changeLanguage(language);
    setDateFnsLocale(language);
}

export const getInterfaceLanguage = (
    accountFeatures: AccountFeatures,
    accountSettings: IAccountSettings,
    userSettings: UserPreferences | undefined,
): string => {
    if (!accountFeatures || !accountFeatures.includes(FEATURE_INTERFACE_I18N)) {
        return defaultLanguage;
    }
    if (userSettings && userSettings.interfaceLanguage) {
        return userSettings.interfaceLanguage;
    }
    if (accountSettings && accountSettings.languages && accountSettings.languages.interfaceLanguage) {
        return accountSettings.languages.interfaceLanguage;
    }
    return defaultLanguage;
}
